---
name: track-undo
description: Pass 2 of the track-task workflow — derive an executable, evidence-based undo journal and an honest gaps report from the ACTUAL editor output (the printed PRE| captures) of the code you just produced.
---

Your C# from the track-task pass has now ACTUALLY been executed in the live
Editor. The arguments carry:

- `execOk`: `"true"` if the exec succeeded, `"false"` if it failed (timeout,
  compile error, exception). On failure the work may have PARTIALLY applied.
- `execOutput`: the real editor output — including every `PRE|` capture line
  your code printed and the final returned summary (or the error text).

Produce the undo journal per unity-agent-protocol §5, derived from EVIDENCE:
use the values actually printed in the `PRE|` lines, never the values you
intended or remembered.

Return a structured result with two fields:

- `undo`: an array of C# strings, in **REVERSE order** of the mutations, that
  exactly inverts the executed work. Each entry must be:
  - **self-contained runnable C#** for `unity-cli exec` — fully-qualified type
    names, no `using`, `while` loops not `foreach`, `sharedMaterial` not
    `material`, its own SubScene bracket where the mutation touched a SubScene
    (open additively, set active, mutate, save, restore parent with
    `OpenSceneMode.Single`), ending in a `return` summary;
  - **exact**: created asset → `AssetDatabase.DeleteAsset("<the exact path
    from the output>")`; created object → find by the exact created name in
    the exact scene, destroy, save; changed value → restore the CAPTURED
    `PRE|` value (never "the default"); added component → remove it; mutated
    existing component → restore the captured fields.
  - If the request was read-only and nothing was mutated, return `[]`.
  - If exec FAILED but some `PRE|` lines printed before the failure, the work
    may have partially applied: emit defensive cleanup entries (check-then-
    restore/delete using the printed captures) so a designer can restore a
    clean state.

- `gaps`: an honest string of anything a follow-up specialist needs: missing
  prerequisites you discovered (a missing prerequisite), `EXPECTED:`-only claims that could
  not be verified, checks that were impossible (e.g. need play mode), and —
  mandatory when `execOk` is `"false"` — a statement that the exec failed and
  what state the editor was likely left in. Use `""` only when there is truly
  nothing to report.

Do not invent: every path, name, and value in `undo` must be traceable to
`execOutput` (or to the code itself for names the code chose). If the output
lacks the evidence needed to invert a mutation, say so in `gaps` instead of
guessing.

**NEVER restore to an ASSUMED value.** If a mutation's pre-state is missing
from `execOutput` (e.g. the code overwrote a director's `playableAsset` but no
`PRE|` line carries the old value), do NOT emit a journal entry that writes a
guessed value (null, a default, a remembered name) — a wrong "restore"
destroys state that was never yours. Instead: include only the SAFE inverse
ops (deleting artifacts the run itself created is always safe), and state in
`gaps` exactly which value could not be restored and why, so the designer can
restore it manually. An honest partial undo beats a destructive complete one.
