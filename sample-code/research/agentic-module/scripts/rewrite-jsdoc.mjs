import ts from "typescript";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourceDirectory = new URL("../src/", import.meta.url);

const parameterDescriptions = {
  actual: "Actual ownership context supplied by the caller.",
  adapter: "Host adapter that supplies the external capability.",
  afterSequence: "Exclusive sequence cursor used to resume replay.",
  allowInProcess:
    "Whether explicitly authorized in-process execution is allowed.",
  artifact: "Artifact metadata and payload to register or persist.",
  argumentsValue: "Tool arguments to protect or restore.",
  attachments: "Attachments to persist for the current execution scope.",
  authorize: "Host authorization callback for the requested resource.",
  batch: "Validated append-log records written as one batch.",
  call: "Normalized provider tool call to process.",
  callback: "Observer invoked for each accepted event.",
  candidate: "Candidate final output to validate.",
  child: "Child path segment or transcript entry identifier.",
  citation: "Current-run citation to register or validate.",
  client: "Connected MCP client used for server operations.",
  code: "Machine-readable error code for the failure.",
  config: "Configuration for the created component.",
  context: "Authenticated execution context for the operation.",
  create: "Whether the durable run must be created before execution.",
  createStore: "Factory that returns an isolated store instance.",
  cursor: "Last event sequence already accepted by the consumer.",
  data: "Durable interaction payload to append.",
  directory: "Directory that contains the append-log files.",
  disabledTools: "Tool names excluded from this execution.",
  effect: "External effect callback to execute.",
  enabled: "Whether the requested tool remains active.",
  entries: "Archive entry paths to validate.",
  error: "Unknown failure value to normalize.",
  event: "Event or lifecycle value to process.",
  events: "Ordered durable events to append atomically.",
  execute: "Callback that performs the gated external effect.",
  execution: "Imported-skill execution isolation policy.",
  expected: "Expected ownership context or state.",
  expectedVersion: "Optimistic version required for the write.",
  flow: "Validated flow definition to execute.",
  force: "Whether compaction must run below the normal threshold.",
  handle: "Persisted deferred-provider handle to poll.",
  history: "Ordered agent transcript used by the operation.",
  id: "Stable identifier of the requested value.",
  ids: "Citation identifiers referenced by final output.",
  includeTools: "Whether provider-visible tool definitions are included.",
  input: "Validated input required by the operation.",
  inputs: "Ordered inputs required by the operation.",
  invocation: "Invocation record to persist or update.",
  key: "Stable transactional document key.",
  kind: "Action or external-effect category used for scheduling.",
  leaseMs: "Writer lease duration in milliseconds.",
  leafId: "Transcript leaf whose ancestry is requested.",
  leftId: "Leaf identifier for the left branch.",
  line: "Complete append-log line to decode.",
  lineNumber: "One-based source line used in corruption diagnostics.",
  listener: "Observer notified for each accepted event.",
  listeners: "Observers that may receive the value.",
  loaders: "Authorized loaders used to resolve external capabilities.",
  manager: "Host MCP manager used to control server lifecycle.",
  manifest: "Validated imported-skill manifest.",
  message: "Human-readable error or transcript message.",
  messages: "Provider transcript messages to inspect.",
  milliseconds: "Maximum duration in milliseconds.",
  mode: "Requested activation or execution-isolation mode.",
  model: "Optional model identifier used for capability detection.",
  mutations: "Ordered session mutations to validate or append.",
  name: "Canonical tool, server, or resource name.",
  node: "TypeScript syntax node being inspected.",
  now: "Injectable clock used for deterministic timestamps.",
  operation: "MCP or durable operation callback to execute.",
  operationId: "Stable identifier of the durable operation.",
  options: "Optional controls for the operation.",
  options1: "Destructured options supplied to the operation.",
  parent: "Parent tool or transcript identifier.",
  path: "Filesystem path of the source or durable file.",
  pending: "Pending execution state to protect or resume.",
  policy: "Server-authoritative policy used for authorization.",
  principalId: "Authenticated principal identifier.",
  protectedArguments: "Protected tool arguments indexed by call identifier.",
  providerRequest: "Normalized request sent to the provider adapter.",
  question: "Clarification question to validate.",
  queue: "Queue lane that receives the input.",
  queueId: "Stable identifier of the queued input.",
  query: "Retrieval query evaluated within the current scope.",
  record: "Durable record used as the replay base.",
  ref: "Local JSON Schema reference to resolve.",
  reference: "Relative storage or artifact reference to validate.",
  request: "Request values required by the operation.",
  requestId: "Stable identifier of the pending request.",
  response: "Response value to validate or persist.",
  retryable: "Whether the caller may safely retry the failure.",
  rightId: "Leaf identifier for the right branch.",
  risk: "Central policy risk classification for the tool.",
  root: "Root JSON Schema containing local definitions.",
  runId: "Stable identifier of the agent run.",
  schema: "JSON Schema value to validate or normalize.",
  server: "MCP server identifier or descriptor.",
  serverName: "Canonical MCP server name.",
  sessionId: "Stable identifier of the durable session.",
  signal: "Abort signal propagated to external work.",
  source: "Factory that creates the asynchronous value stream.",
  span: "Telemetry span to sanitize and publish.",
  state: "Current projected state used by the operation.",
  status: "Terminal or lifecycle status to persist.",
  step: "Flow or durable step to process.",
  storageRef: "Opaque relative reference owned by host storage.",
  suppressed: "Tool names suppressed from MCP exposure.",
  targetId: "Target transcript leaf identifier.",
  text: "Source text or output content to process.",
  timeoutMs: "Maximum operation duration in milliseconds.",
  tool: "Tool definition subject to policy or execution.",
  toolContext: "Current tool execution context.",
  toolName: "Canonical name of the tool to update.",
  tools: "Tool definitions available to the operation.",
  type: "Durable interaction event type to append.",
  update: "Transactional callback that returns the next document value.",
  value: "Value to validate, transform, or persist.",
  variables: "Template variables available to flow expansion.",
  workerId: "Identifier of the worker requesting the lease.",
};

/** Selects declarations that represent a named module or contract callable. */
function isCallable(node) {
  // Match the production documentation gate exactly.
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

/** Resolves the executable function expression for variable and property callables. */
function callableExpression(node) {
  // Declaration callables are their own syntax node.
  return ts.isVariableDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node)
    ? node.initializer
    : node;
}

/** Returns a stable display name for summaries generated from undocumented contracts. */
function callableName(node) {
  // Prefer declared names and use operation only for structurally anonymous declarations.
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (node.name && "text" in node.name) return node.name.text;
  return "operation";
}

/** Returns the documentation target that owns a callable's leading comment. */
function documentationTarget(node) {
  // Variable JSDoc belongs to the complete variable statement.
  return ts.isVariableDeclaration(node) ? node.parent.parent : node;
}

/** Flattens TypeScript JSDoc fragments into plain text. */
function documentationText(value) {
  // Preserve linked-name text without retaining compiler nodes.
  if (typeof value === "string") return value.trim();
  return (
    value
      ?.map((part) => part.text ?? part.name?.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

/** Returns the canonical JSDoc name for one callable parameter. */
function parameterName(parameter, index) {
  // Destructured parameters receive a stable positional name.
  return ts.isIdentifier(parameter.name)
    ? parameter.name.text
    : index === 0
      ? "options"
      : `options${index + 1}`;
}

/** Produces a concise summary when a callable has no existing documentation. */
function generatedSummary(name) {
  // Common public operations receive intent-oriented descriptions.
  const summaries = {
    add: "Adds one value to the current ledger.",
    addArtifact:
      "Registers an artifact produced by the current tool execution.",
    addCitation: "Registers a citation produced by the current tool execution.",
    append: "Appends an optimistic batch to durable state.",
    ask: "Submits bounded clarification questions through the host adapter.",
    authorize: "Determines whether policy permits the requested operation.",
    builtIn: "Loads a built-in tool by identifier.",
    callTool: "Calls one normalized MCP tool through the connected client.",
    canManageTools: "Determines whether the caller may manage tool activation.",
    child: "Loads a child-agent tool by identifier.",
    claim: "Attempts to acquire the scoped writer lease.",
    close: "Closes the requested durable resource.",
    compact: "Compacts transcript history within the configured budget.",
    complete: "Completes one provider request.",
    create: "Creates a new durable resource.",
    emit: "Publishes one agent lifecycle event.",
    estimateTokens: "Estimates token usage for the supplied transcript.",
    execute: "Executes the configured operation.",
    executeEffect: "Executes one effect through the configured action driver.",
    executeTool: "Executes one validated tool call.",
    failure: "Creates a typed failed agent result.",
    fetchDeferred: "Polls one persisted deferred-provider handle.",
    flow: "Loads a flow-backed tool by identifier.",
    health: "Reads the current MCP server health state.",
    imported: "Loads an imported-skill tool by identifier.",
    isApproved: "Determines whether the tool already has approval.",
    list: "Lists values visible in the current scope.",
    listTools: "Lists normalized tools exposed by the MCP server.",
    load: "Loads the requested durable value.",
    mcp: "Loads an MCP-backed tool by identifier.",
    onCheckpoint: "Captures the latest recoverable runtime checkpoint.",
    onCompactionEffect: "Persists one compaction-effect lifecycle transition.",
    onContextCompacted: "Forwards a completed compaction to the host hook.",
    onToolEffect: "Persists one tool-effect lifecycle transition.",
    read: "Reads one authorized value.",
    releaseLease: "Releases the writer lease owned by the current worker.",
    reload: "Reloads the configured MCP server connection.",
    request: "Requests a host-mediated interaction.",
    resolve: "Settles a queued manual-drive action.",
    renewLease: "Renews a live writer lease for the current worker.",
    save: "Persists a scoped attachment or artifact value.",
    search: "Searches authorized host evidence for the current run.",
    serializeSseEvent: "Serializes one sequenced event for an SSE response.",
    serializeWebSocketEvent:
      "Serializes one sequenced event for a WebSocket frame.",
    settle: "Atomically settles durable events and terminal state.",
    start: "Starts the configured MCP server connection.",
    stop: "Stops the configured MCP server connection.",
    store: "Persists one value through the host adapter.",
    stream: "Streams one provider request.",
    supportsNativeToolCalling:
      "Determines whether native tool calling is supported.",
    take: "Consumes a scoped attachment from host storage.",
    takeSteer: "Merges host and durable steer inputs at a safe loop boundary.",
    transact:
      "Runs one atomic update against the transactional document adapter.",
  };
  return (
    summaries[name] ??
    `Performs the ${name} operation for the current contract.`
  );
}

/** Describes one parameter without restating its TypeScript type. */
function describeParameter(name) {
  // Known boundary names receive domain-specific descriptions; other names remain explicit.
  return (
    parameterDescriptions[name] ??
    `Value supplied as ${name.replace(/^_/, "")} to this operation.`
  );
}

/** Describes the observable completion value of one callable. */
function describeReturn(node, name, source) {
  // Prefer explicit return types, then use stable operation-name semantics.
  const expression = callableExpression(node);
  const type = expression.type?.getText(source) ?? "";
  if (/Promise\s*<\s*void\s*>/.test(type))
    return "A promise that resolves when the operation completes.";
  if (/\bvoid\b/.test(type))
    return "Nothing; completion indicates that the operation finished.";
  if (/AsyncIterable/.test(type))
    return "An asynchronous stream of provider or action values.";
  if (/Promise/.test(type))
    return "A promise that resolves with the operation result.";
  if (
    /boolean/.test(type) ||
    /^(is|has|can|should|supports|owns|valid|authorize)/i.test(name)
  )
    return "Whether the requested condition is satisfied.";
  if (/string/.test(type) || /^serialize/i.test(name))
    return "The resulting serialized string.";
  if (/^(list|replay)/i.test(name))
    return "The ordered values produced by the operation.";
  if (/^(create|normalize|project|reduce)/i.test(name))
    return "The created or normalized operation result.";
  return `The ${name} result produced for the current operation.`;
}

/** Reports whether a callable body directly declares a throw statement. */
function containsThrow(node) {
  // Nested callables document their own failure behavior.
  const expression = callableExpression(node);
  const body = expression.body;
  let found = false;
  const visit = (child) => {
    if (found || (child !== body && isCallable(child))) return;
    if (ts.isThrowStatement(child)) found = true;
    else ts.forEachChild(child, visit);
  };
  if (body) visit(body);
  return found;
}

/** Builds a complete JSDoc block for one callable. */
function renderDocumentation(node, source, existing, indent) {
  // Preserve a useful existing summary and standardize all contract tags.
  const name = callableName(node);
  let summary = documentationText(existing?.comment);
  if (
    !summary ||
    /^Performs the .+ operation for (this|the current) contract\.$/.test(
      summary
    )
  )
    summary = generatedSummary(name);
  if (!/[.!?]$/.test(summary)) summary += ".";
  const expression = callableExpression(node);
  const lines = [`${indent}/**`, `${indent} * ${summary}`];
  expression.parameters.forEach((parameter, index) => {
    const parameterId = parameterName(parameter, index);
    lines.push(
      `${indent} * @param ${parameterId} - ${describeParameter(parameterId)}`
    );
  });
  if (
    !ts.isConstructorDeclaration(node) &&
    !ts.isSetAccessorDeclaration(node)
  ) {
    lines.push(`${indent} * @returns ${describeReturn(node, name, source)}`);
  }
  if (containsThrow(node))
    lines.push(
      `${indent} * @throws When validation, persistence, policy, or the delegated operation fails.`
    );
  lines.push(`${indent} */`);
  return lines.join("\n");
}

/** Rewrites every callable JSDoc block in one TypeScript source file. */
function rewriteFile(path) {
  // Apply edits from the end of the file so source offsets remain stable.
  const text = readFileSync(path, "utf8");
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const edits = [];
  const seen = new Set();
  const visit = (node) => {
    if (isCallable(node)) {
      const target = documentationTarget(node);
      const key = `${target.pos}:${target.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        const documents = ts.getJSDocCommentsAndTags(target).filter(ts.isJSDoc);
        const existing = documents.at(-1);
        const start =
          documents.at(0)?.getStart(source) ?? target.getStart(source);
        const end = existing?.end ?? start;
        const lineStart =
          text.lastIndexOf("\n", target.getStart(source) - 1) + 1;
        const indent =
          text.slice(lineStart, target.getStart(source)).match(/^\s*/)?.[0] ??
          "";
        const replacement = `${renderDocumentation(node, source, existing, indent)}${existing ? "" : `\n${indent}`}`;
        edits.push({ start, end, replacement });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  let updated = text;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    updated =
      updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
  }
  const documented = ts.createSourceFile(
    path,
    updated,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const formatted = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printFile(documented);
  writeFileSync(path, formatted, "utf8");
}

// Rewrite only shipped source files; tests and host documentation remain untouched.
for (const name of readdirSync(sourceDirectory)
  .filter((value) => value.endsWith(".ts"))
  .sort()) {
  rewriteFile(fileURLToPath(new URL(name, sourceDirectory)));
}
