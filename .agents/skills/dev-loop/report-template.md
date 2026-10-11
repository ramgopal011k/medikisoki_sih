# dev-loop run — <task>

**Date:** <ISO 8601 timestamp with timezone>
**Loops:** <N>/3
**Mode:** Subagent / Sequential
**Verdict:** SHIP / REVISE / BLOCK

## Summary

<Exactly three plain-language sentences: what was attempted, what evidence established, and the outcome or blocker. Do not overstate confidence.>

## What was built

- <Implemented behavior with evidence.>
- <Additional behavior, if any.>
- <Important limitation, if any.>

## Mattpock skill integration

- **Discovery:** FOUND / NOT_FOUND / INCOMPLETE
- **Skill:** Mattpock — <declared name and repository-relative path, or NOT FOUND>
- **Loading/execution:** <What actually happened; do not conflate reading instructions with invocation>
- **Methods applied:** <Mattpock methods actually used>
- **Important findings:** <Findings and disposition>
- **Limitations:** <Missing capability, failed loading, or unverified claims>

Mattpock is the requested project skill. Do not silently substitute an attack/red-team/other skill if Mattpock cannot be found. Built-in adversarial tests may still be used, but report them separately and state clearly that Mattpock was not loaded.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| AC-1 | <Expected behavior> | PASS / FAIL / BLOCKED | <Actual command, exit code, relevant output, or file:line> |
| AC-2 | <Expected behavior> | PASS / FAIL / BLOCKED | <Actual command, exit code, relevant output, or file:line> |

Include every criterion from the approved plan. Do not mark an unexecuted or inconclusive test as passed. Distinguish environmental blockers from confirmed defects.

## Files changed

| Path | +Lines | -Lines |
|---|---:|---:|
| <Repository-relative path> | <Actual count> | <Actual count> |

Include files changed by this run only. Distinguish pre-existing changes. Use actual diff statistics. If no files changed, state `No files changed`.

## Adversarial tests run

- **<Test 1>:** Input: <edge case>. Method: <test method>. Command: `<actual command>`. Expected: <required behavior>. Observed: <actual result>. Result: PASS / FAIL / BLOCKED.
- **<Test 2>:** Input: <edge case>. Method: <test method>. Command: `<actual command>`. Expected: <required behavior>. Observed: <actual result>. Result: PASS / FAIL / BLOCKED.
- **<Test 3>:** Input: <edge case>. Method: <test method>. Command: `<actual command>`. Expected: <required behavior>. Observed: <actual result>. Result: PASS / FAIL / BLOCKED.

Attempt at least three relevant adversarial cases. If execution was impossible, state the exact blocker rather than inventing results. For trivial or documentation-only tasks, choose appropriate structural, link, schema, or compatibility checks.

## Guard scan

- **Secrets:** NONE / <sanitized findings with severity and path:line>
- **Junk:** NONE / <findings and rationale>
- **Git hygiene:** OK / <issues>
- **Scan coverage:** <Scans completed and limitations>
- **Final-state verification:** <Evidence that the tested, guarded, and reviewed state matches>

Never include actual secret values or unredacted matching lines. A scan that did not run must be marked incomplete, not clean.

## Deviations from plan

- <Deviation, reason, authorization status, and evidence.>
- <Deviation, reason, authorization status, and evidence.>

Use `none` only when the approved plan was followed without deviation.

## What user should test manually

- <Specific behavior needing manual verification.>
- <Exact steps or inputs.>
- <Expected result.>

If no additional manual testing is needed, explain why the available automated evidence is sufficient for this task's scope. Do not claim a browser or external integration was tested unless it actually was.

## What's still broken or deferred

- <Failed criterion, known defect, unverified behavior, or deferred work.>
- <Why it remains unresolved and what blocks it.>

Use `none known` only when justified by available evidence; absence of observed failures is not proof that no other defect exists.

## Next action

**SHIP:** Ready for user review and possible manual local commit. No commit, push, or deployment was performed.

**REVISE:** <Exact fix and required verification; rerun `/dev-loop` with this feedback.>

**BLOCK:** <Specific blocker, supporting evidence, and what must be unblocked.>

Include only the action matching the final verdict.

## Evidence notes

- **Commands executed:** <Commands or references to actual command records>
- **Commands not executed:** <Commands skipped and why>
- **Pre-existing changes:** <Existing modifications distinguished from run changes>
- **Loop accounting:** <What counted as each implementation attempt>
- **Secret handling:** <Confirm values were not disclosed and output was sanitized>
- **Report persistence:** WRITTEN / NOT_WRITTEN
- **Run-record persistence:** WRITTEN / NOT_WRITTEN
