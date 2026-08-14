import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourceDirectory = new URL("../src/", import.meta.url);
const failures = [];

/** Returns a stable human-readable name for each checked callable. */
function callableName(node) {
  // Prefer declared identifiers and fall back to the constructor keyword.
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (
    node.name &&
    (ts.isIdentifier(node.name) ||
      ts.isPrivateIdentifier(node.name) ||
      ts.isStringLiteral(node.name))
  )
    return node.name.text;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
    return node.name.text;
  return "<anonymous>";
}

/** Selects named callables that own module behavior rather than short inline callbacks. */
function isCheckedCallable(node) {
  // Check implementations, public contract signatures, and named function variables.
  if (ts.isFunctionDeclaration(node) && node.name) return true;
  if (
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
    return true;
  return (
    (ts.isVariableDeclaration(node) ||
      ts.isPropertyAssignment(node) ||
      ts.isPropertyDeclaration(node)) &&
    !!node.initializer &&
    (ts.isFunctionExpression(node.initializer) ||
      ts.isArrowFunction(node.initializer))
  );
}

/** Resolves the executable body for every supported callable syntax. */
function callableBody(node) {
  // Variable declarations keep their body on the initializer; declarations expose it directly.
  if (
    ts.isVariableDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node)
  )
    return node.initializer?.body;
  return node.body;
}

/** Returns the declared parameter list for implementations and function variables. */
function callableParameters(node) {
  // Function variables keep parameters on their initializer rather than the declaration.
  return ts.isVariableDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node)
    ? (node.initializer?.parameters ?? [])
    : node.parameters;
}

/** Returns the canonical documentation name for one callable parameter. */
function parameterName(parameter, index) {
  // Destructured inputs use a stable positional name because JSDoc cannot repeat the binding pattern safely.
  return ts.isIdentifier(parameter.name)
    ? parameter.name.text
    : index === 0
      ? "options"
      : `options${index + 1}`;
}

/** Converts compiler JSDoc comment fragments into plain validation text. */
function documentationText(value) {
  // Flatten linked-name fragments while preserving their human-readable text.
  if (typeof value === "string") return value.trim();
  return (
    value
      ?.map((part) => part.text ?? part.name?.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

/** Reports whether an implementation contains a directly declared throw statement. */
function containsThrow(node) {
  // Descend only through this callable body; nested callables own their own contracts.
  let found = false;
  const visit = (child) => {
    if (found || (child !== node && isCheckedCallable(child))) return;
    if (ts.isThrowStatement(child)) found = true;
    else ts.forEachChild(child, visit);
  };
  const body = callableBody(node);
  if (body) visit(body);
  return found;
}

/** Walks one TypeScript source file and records missing documentation evidence. */
function inspectFile(path) {
  // Parse with the compiler used by the package so syntax handling matches the build.
  const text = readFileSync(path, "utf8");
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const visit = (node) => {
    if (isCheckedCallable(node)) {
      const target = ts.isVariableDeclaration(node) ? node.parent.parent : node;
      const jsDoc = ts
        .getJSDocCommentsAndTags(target)
        .filter(ts.isJSDoc)
        .at(-1);
      const body = callableBody(node);
      const bodyPrefix =
        body && ts.isBlock(body)
          ? text.slice(
              body.getStart(source) + 1,
              body.statements[0]?.getStart(source) ?? body.getEnd() - 1
            )
          : "";
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (!jsDoc) {
        failures.push(`${path}:${line} ${callableName(node)} missing JSDoc`);
      } else {
        const summary = documentationText(jsDoc.comment);
        const parameters = jsDoc.tags?.filter(ts.isJSDocParameterTag) ?? [];
        const returns = jsDoc.tags?.filter(ts.isJSDocReturnTag) ?? [];
        const throwsTags =
          jsDoc.tags?.filter((tag) => tag.tagName.text === "throws") ?? [];
        if (
          summary.length < 12 ||
          !/[.!?]$/.test(summary) ||
          /^Performs the .+ operation for the current contract\.$/.test(summary)
        )
          failures.push(
            `${path}:${line} ${callableName(node)} needs a complete punctuated summary`
          );
        const expectedParameters = callableParameters(node).map(parameterName);
        const documentedParameters = parameters.map((tag) =>
          tag.name.getText(source).replace(/^\[|\]$/g, "")
        );
        if (
          parameters.length !== expectedParameters.length ||
          parameters.some((tag) => documentationText(tag.comment).length < 5) ||
          documentedParameters.some(
            (name, index) => name !== expectedParameters[index]
          )
        ) {
          failures.push(
            `${path}:${line} ${callableName(node)} needs one described @param per parameter`
          );
        }
        if (
          !ts.isConstructorDeclaration(node) &&
          !ts.isSetAccessorDeclaration(node) &&
          (returns.length !== 1 ||
            documentationText(returns[0].comment).length < 5 ||
            /^The result produced by the operation\.$/.test(
              documentationText(returns[0].comment)
            ))
        ) {
          failures.push(
            `${path}:${line} ${callableName(node)} needs one described @returns tag`
          );
        }
        if (
          containsThrow(node) &&
          (throwsTags.length === 0 ||
            throwsTags.some((tag) => documentationText(tag.comment).length < 5))
        ) {
          failures.push(
            `${path}:${line} ${callableName(node)} needs a described @throws tag`
          );
        }
      }
      if (body && ts.isBlock(body) && !/\/\/|\/\*/.test(bodyPrefix))
        failures.push(
          `${path}:${line} ${callableName(node)} missing inline body comment`
        );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// Check every shipped source file and fail with actionable locations.
for (const name of readdirSync(sourceDirectory)
  .filter((name) => name.endsWith(".ts"))
  .sort()) {
  inspectFile(fileURLToPath(new URL(name, sourceDirectory)));
}
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
}
