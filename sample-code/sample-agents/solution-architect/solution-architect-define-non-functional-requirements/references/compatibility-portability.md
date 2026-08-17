# Compatibility and portability requirements

## Use when

Use this variant when behavior must remain valid across clients, platforms, protocols, vendors, versions, regions, or deployment models.

## Task guidance

Define the supported compatibility matrix, minimum and maximum versions, protocol behavior, data-format guarantees, deprecation window, migration path, feature degradation, and validation method. For portability, identify platform assumptions, replaceable dependencies, packaging constraints, configuration boundaries, and evidence required for each target environment.

## Decision checks

- Distinguish backward, forward, data, API, browser, device, and deployment compatibility.
- State unsupported combinations and end-of-support rules explicitly.
- Include migration, rollback, coexistence, and vendor-exit consequences where applicable.
