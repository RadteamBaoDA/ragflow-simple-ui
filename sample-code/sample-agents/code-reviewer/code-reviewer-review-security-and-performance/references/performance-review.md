# Performance-focused review

## Use when

Use this variant when latency, throughput, allocations, I/O, or query cost may regress.

## Task guidance

For **Review Security and Performance**, identify hot paths, algorithmic cost, batching, caching, query shape, benchmarks, and workload evidence.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
