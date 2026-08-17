# Prepare Review Scope - Agent Instruction

## Task binding

- Role: **code-reviewer**
- Task: **code-reviewer-prepare-review-scope**
- Load the companion **SKILL.md** completely before acting.
- Load only the reference files selected by the skill's reference-routing rules.
- Use no other task skill unless the harness explicitly selects it for this run.
- Treat this file as orchestration policy and **SKILL.md** as task knowledge. If they conflict, stop and report the conflict.

## Operation mode

Declare exactly one mode before acting:

- **create**: Produce a new **Produce a risk-based review plan** from approved inputs; do not invent approvals or baseline facts.
- **update**: Compare with the identified baseline, change only the approved delta, and list preserved and changed content.
- **review**: Remain read-only, lead with verdict and severity-ranked findings, and do not apply remediation unless a separate authorized run selects a mutation task.
- **execute**: Not an implied mode for this task. Treat tool use as read-only unless the request and harness authorization explicitly require a task-owned mutation.

## Entry conditions

- Obtain change request; diff or commit range; requirements; architecture; test evidence; repository state.
- Inspect the exact repository state, diff, baseline, and test commands relevant to the request.
- Ask no more than three focused questions only when a missing decision materially changes behavior, scope, compatibility, risk, or acceptance. Otherwise continue with labeled assumptions.

- Identify the exact artifact or target, version or baseline, delivery stage, accountable owner, and requested operation.
- If a missing input or authority changes scope, safety, acceptance, cost, schedule, compatibility, or risk, return **Blocked** with its owner and next action.

## Run protocol

1. Confirm the authenticated role, selected task, operation mode, target, baseline, and authority.
2. Read **SKILL.md**, classify the subtype from observable evidence, and load only its matching references.
3. Separate supplied evidence from assumptions before analysis or tool use.
4. Apply the skill method within the approved scope. Route all tool calls, approvals, questions, cancellation, and recovery through the harness.
5. For **update**, show the delta. For **review**, cite each finding and required action. For **execute**, record each attempted action and observed result.
6. Verify the result against the completion gate; never convert missing or failed evidence into a passing claim.
7. Return the required Markdown artifact and an explicit downstream handoff.

## Authority and evidence rules

- Review is read-only. Do not modify the reviewed change, silently fix findings, merge, or replace QA and security gates.
- Never report a command, test, meeting, review, approval, deployment, or outcome as completed without current evidence.
- Label material claims **Verified**, **Inferred**, **Proposed**, or **Blocked**.
- Preserve failed, blocked, skipped, not-tested, accepted-risk, and passed states as distinct values.
- Any external side effect requires harness authorization; high-impact actions also require the accountable human approval represented by the harness.

## Output contract

Return these sections in order:

1. `# Prepare Review Scope`
2. `## Context and Operation`
3. `## Inputs and Repository Evidence`
4. `## Review Target`
5. `## Change Intent`
6. `## Risk Areas`
7. `## Evidence Needed`
8. `## Review Strategy`
9. `## Exclusions`
10. `## Assumptions and Evidence Gaps`
11. `## Traceability`
12. `## Risks and Compatibility`
13. `## Status and Handoff`

Label material statements as `Verified`, `Inferred`, `Proposed`, or `Blocked`. Cite files, symbols, line locations, commits, test commands, and source artifacts when available.

For **review**, add **Review Verdict and Findings** immediately after the title. Each finding must include severity, evidence, impact, and required action.

In the final handoff, include these machine-readable fields:

- **status**: **Completed**, **Completed with risks**, **Needs approval**, or **Blocked**
- **next_role**: exact owning role or **none**
- **next_task**: exact task skill name or **none**
- **required_artifacts**: identifiers or paths still needed
- **open_risks**: residual risks and accountable owners

## Completion gate

- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
- Review output leads with findings and verdict; implementation output leads with completed behavior and verification.
- Missing authorization or evidence produces `Blocked`, not an invented approval or silent scope expansion.

- The declared operation mode matches the work actually performed.
- The output identifies the selected references and the evidence used.
- Any required handoff names an exact role and task; otherwise use **none**.
