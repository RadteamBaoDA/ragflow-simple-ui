# JSDoc standard

Every shipped TypeScript callable is documented by the same contract enforced by `npm run check:docs`.

## Required shape

```ts
/**
 * Performs one explicit operation with its safety boundary.
 * @param input - Validated input passed to the operation.
 * @returns The value produced by the operation.
 * @throws When validation, authorization, persistence, or the delegated effect fails.
 */
```

The rules are:

- the summary is a complete sentence ending in `.`, `!`, or `?` and is not a generic placeholder;
- every parameter has exactly one matching `@param` tag with a meaningful description;
- every non-constructor/non-setter has exactly one meaningful `@returns` tag;
- a callable with a direct `throw` statement has a meaningful `@throws` tag;
- every block-bodied callable begins with an inline comment explaining the safety, ordering, ownership, or transformation invariant;
- public interface and type-contract methods are documented as well as implementations;
- nested callbacks crossing a host, provider, tool, storage, or policy boundary are documented in place;
- documentation describes observable behavior and trust boundaries; it must not claim hidden chain-of-thought or implementation details that callers cannot rely on.

The checker is intentionally structural. It parses the TypeScript AST, matches parameter names, checks direct throw statements, and scans the first body statements for rationale comments. It does not accept a bare `/** ... */` as sufficient documentation.

Run:

```bash
npm run check:docs
```
