import { AgenticError } from "./errors.ts";
import type { Citation } from "./types.ts";
export class ProvenanceLedger {
  readonly #citations = new Map<string, Citation>();
  /**
   * Adds one current-run citation and rejects conflicting identity reuse.
   * @param citation - Current-run citation to register or validate.
   * @returns Nothing; completion indicates that the operation finished.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  add(citation: Citation): void {
    // A repeated ID is idempotent only when it points to the same source.
    if (!citation.id || !citation.sourceRef) {
      throw new AgenticError(
        "INVALID_CITATION",
        "Citation id and sourceRef are required."
      );
    }
    this.#citations.set(citation.id, citation);
  }
  /**
   * Returns an immutable snapshot of current-run provenance.
   * @returns The ordered values produced by the operation.
   */
  list(): Citation[] {
    // Copy both the collection and entries so callers cannot mutate ledger state.
    return [...this.#citations.values()];
  }
  /**
   * Resolves cited IDs and fails closed when a model invents an unknown citation.
   * @param ids - Citation identifiers referenced by final output.
   * @returns The requireKnown result produced for the current operation.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  requireKnown(ids: readonly string[]): Citation[] {
    // Validate every ID against evidence registered during this run.
    return ids.map((id) => {
      const citation = this.#citations.get(id);
      if (!citation)
        throw new AgenticError("INVALID_CITATION", `Unknown citation: ${id}`);
      return citation;
    });
  }
}
