# dev-loop skill package

This archive installs a repository-local `dev-loop` skill with five role prompts, a report template, a latest-run placeholder, and a skills registry entry.

## Contents

```text
.agents/
├── skills-lock.json
└── skills/
    └── dev-loop/
        ├── SKILL.md
        ├── report-template.md
        ├── last-run.md
        └── agents/
            ├── planner-adviser.md
            ├── worker.md
            ├── tester.md
            ├── guard.md
            └── reviewer.md
```

## Install

1. Extract this ZIP into the repository root, preserving the `.agents/` directory.
2. If `.agents/skills-lock.json` already exists, merge the `dev-loop` object into its existing schema and preserve every existing registration. Do not replace an existing registry with this package's one-entry file.
3. Check whether the active coding agent supports the `.agents/skills/` location and `/dev-loop` invocation. A manifest entry alone cannot enable a runtime feature the host does not support.
4. Validate the new registry if it is a standalone JSON object:

   ```bash
   python -m json.tool .agents/skills-lock.json
   git status --short
   git diff --check
   ```

5. Inspect the complete diff and confirm the package did not overwrite unrelated files before manually committing.

## Use

Invoke once with a task, for example:

```text
/dev-loop add prescription OCR parsing
```

The skill dynamically searches the repository's skill directories and registries for the specifically named Mattpock skill (including the user-provided spelling `mattppock`), reads its actual instructions, and incorporates relevant methods according to task risk and complexity. A generic attack/red-team skill is not a substitute for Mattpock; if Mattpock cannot be found, the run records `NOT_FOUND` or `INCOMPLETE` while built-in adversarial tests may still be performed separately.

The skill never commits, pushes, or deploys. It allows at most three implementation loops, requires an independent tester and a final read-only guard, and records the terminal result in `last-run.md`. Skill discovery does not prove host-level skill invocation; reports must distinguish instructions inspected from procedures actually executed.

## Registry merge warning

The included `.agents/skills-lock.json` is a valid one-entry registry for a fresh setup. Existing repositories may use a different structure; merge the entry in accordance with the existing file's schema rather than replacing it.
