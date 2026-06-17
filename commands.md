# Skill Candidate Detector Commands

This file defines the commands developers can use when operating the `SkillForSkill` MVP. After installation, agents should treat the generated `SkillForSkill/SKILL.md` as the source of truth and run commands with the local absolute `main.js` path written during installation.

All commands are executed through the CLI by default:

```bash
node /absolute/path/to/SkillForSkill/main.js --- <command> [--key value]
```

CLI output is JSON so agents can read it and decide the next step.

## `list-works`

Reads the current work folders under `work/`, allowing the agent to decide whether a new task should be added to an existing work folder or whether a new work folder is needed.

```bash
node /absolute/path/to/SkillForSkill/main.js --- list-works
```

By default, this lists only work folders under `work/` and does not read `discarded_work/`.

To also read discarded work that the user has marked as unnecessary for future handling, use:

```bash
node /absolute/path/to/SkillForSkill/main.js --- list-works --includeFutureUnneededDiscardedWork true
```

This parameter only additionally lists work in `discarded_work/` where `isFutureWorkUnneeded: true`; discarded work where `isFutureWorkUnneeded: false` is not listed.

Each returned work includes:

- `workName`
- `workDir`
- `description`
- `taskCount`
- `taskFiles`
- `hasPotentialSkill`
- `isDiscarded`
- `isFutureWorkUnneeded`

## `list-work-candidates`

Lists work types under `work/` that have exceeded the task-count threshold and do not yet have a potential skill.

```bash
node /absolute/path/to/SkillForSkill/main.js --- list-work-candidates
```

Results are sorted by work folder creation time from oldest to newest. If creation times are equal, results are sorted by `workName`.

Use `taskLimit` to override `workTaskLimit` from `config.json`:

```bash
node /absolute/path/to/SkillForSkill/main.js --- list-work-candidates --taskLimit 5
```

Each returned candidate work includes:

- `workName`
- `workDir`
- `description`
- `createdAt`
- `createdAtMs`
- `taskCount`
- `taskLimit`
- `taskFiles`
- `hasPotentialSkill`
- `isSkillCandidate`

## `list-potential-skills`

Lists all potential skill Markdown draft paths under `potential_skill/`.

```bash
node /absolute/path/to/SkillForSkill/main.js --- list-potential-skills
```

By default, this reads `~/.SkillForSkillStorage/potential_skill/`. Use `rootDir` only for tests or special storage locations:

```bash
node /absolute/path/to/SkillForSkill/main.js --- list-potential-skills --rootDir /tmp/test-skill-data
```

If the `potential_skill/` folder does not exist, the command returns an empty array and does not create the folder.

Returns a sorted JSON array of Markdown file paths:

```json
[
  "/Users/example/.SkillForSkillStorage/potential_skill/example-a.md",
  "/Users/example/.SkillForSkillStorage/potential_skill/example-b.md"
]
```

## `get-work-skill-reference`

Reads the full content of an active work and builds reference text the agent can use to generate a skill.

```bash
node /absolute/path/to/SkillForSkill/main.js --- get-work-skill-reference --workName debugging
```

Effects:

- Reads only `~/.SkillForSkillStorage/work/<workName>/`.
- Reads `description.md`.
- Reads all task Markdown files in sorted order.
- Combines the work name, description, and all task content into `referenceText`.

Returns:

- `workName`
- `workDir`
- `description`
- `taskFiles`
- `referenceText`

## `add-work`

Adds a work folder and ensures the folder contains `description.md` and `state.json`.

```bash
node /absolute/path/to/SkillForSkill/main.js --- add-work --workName debugging --description "Handle debugging tasks and similar work that can be investigated through repeatable steps."
```

Effects:

- Creates `~/.SkillForSkillStorage/work/<workName>/`.
- Creates `~/.SkillForSkillStorage/work/<workName>/description.md` if it does not exist.
- Creates `~/.SkillForSkillStorage/work/<workName>/state.json` if it does not exist.
- Does not overwrite existing `description.md`.
- Defaults `state.json` to `{ "hasPotentialSkill": false }`.

## `add-task`

Adds a task Markdown file to the specified work.

```bash
node /absolute/path/to/SkillForSkill/main.js --- add-task --workName debugging --taskName task-001 --content "# Task"
```

Effects:

- Creates or uses `~/.SkillForSkillStorage/work/<workName>/`.
- Ensures `state.json` exists.
- Adds `~/.SkillForSkillStorage/work/<workName>/<taskName>.md`.
- If a task file with the same name already exists, the command should fail and must not overwrite the existing task.

## `add-potential-skill`

Adds a potential skill Markdown file and marks the source work as having produced a potential skill.

```bash
node /absolute/path/to/SkillForSkill/main.js --- add-potential-skill --workName debugging --skillName error-debugging-helper --content "# error-debugging-helper"
```

Effects:

- Confirms that `~/.SkillForSkillStorage/work/<workName>/` exists.
- Creates or uses `~/.SkillForSkillStorage/potential_skill/`.
- Adds `~/.SkillForSkillStorage/potential_skill/<skillName>.md`.
- Sets `hasPotentialSkill` to `true` in `~/.SkillForSkillStorage/work/<workName>/state.json`.
- If a skill file with the same name already exists, the command should fail and must not overwrite the existing recommendation.
- If potential skill creation fails, the work state should not be updated.

## `discard-work`

Moves the specified work from `work/` to `discarded_work/`, preserving work types that have been judged unsuitable for conversion into a skill.

```bash
node /absolute/path/to/SkillForSkill/main.js --- discard-work --workName debugging --isFutureWorkUnneeded true
```

Effects:

- Moves the entire folder from `~/.SkillForSkillStorage/work/<workName>/`.
- Moves it to `~/.SkillForSkillStorage/discarded_work/<workName>/`.
- Updates `isFutureWorkUnneeded` in `discarded_work/<workName>/state.json`.
- `isFutureWorkUnneeded` must be `true` or `false`.
- If the source work does not exist, the command should fail.
- If the target discarded work already exists, the command should fail and must not overwrite existing data.

Returns:

- `workDir`
- `discardedWorkDir`
- `statePath`
