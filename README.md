# SkillForSkill

SkillForSkill helps Codex notice repeated work patterns and turn them into reusable skill candidates.

After each meaningful task, the installed SkillForSkill instructions guide the agent to:

- Decide whether the task is worth recording.
- Group similar tasks into reusable work categories.
- Track repeated tasks under `~/.SkillForSkillStorage`.
- Suggest a potential skill when a work category appears often enough.
- Respect user decisions to reject or stop prompting for certain skill ideas.

This project is an MVP. It records work samples and creates potential skill drafts, but it does not automatically install generated skill candidates.

## Requirements

- Node.js
- Codex
- macOS/Linux shell, WSL, or Git Bash

No `npm install` or build step is required for normal use. The project currently uses only Node.js built-in modules and local files.

## Installation

Clone or download this repository, then run the installer.

### macOS, Linux, WSL, or Git Bash

Install for Codex:

```bash
./install.sh
```

You can also pass the target explicitly:

```bash
./install.sh --target codex
```

If `--target` is omitted, the installer defaults to Codex.

## What Installation Does

The installer temporarily generates `skills/SkillForSkill/SKILL.md` from `agent-operations.md`, replacing local placeholders with:

- The absolute path to this repository's `main.js`.
- The storage directory `~/.SkillForSkillStorage`.

Then it installs the generated skill into Codex and removes the temporary project `skills/` directory after the copy and config update succeed:

| Target | Skill install path | Global instruction file |
| --- | --- | --- |
| Codex | `~/.codex/skills/SkillForSkill` | `~/.codex/config.toml` |

The global instruction block is wrapped with SkillForSkill markers so uninstall can remove only the block it added.

The repository's `skills/` directory is an install-time generated artifact. It is not kept in the project after a successful install; the runtime copy lives under the target user's skill directory.

After installing, restart Codex or open a new thread, so the agent reloads skill metadata and global instructions.

## Uninstallation

### macOS, Linux, WSL, or Git Bash

Uninstall from Codex:

```bash
./uninstall.sh
```

You can also pass the target explicitly:

```bash
./uninstall.sh --target codex
```

If `--target` is omitted, uninstall defaults to Codex.

Uninstall removes the installed `SkillForSkill` skill directory and removes the marked global instruction block. It does not delete `~/.SkillForSkillStorage`.

## Data Storage

SkillForSkill stores its data in:

```txt
~/.SkillForSkillStorage
```

The storage layout is:

```txt
.SkillForSkillStorage/
  work/
    <work-type>/
      description.md
      state.json
      <task>.md
  discarded_work/
  potential_skill/
  discarded_skill/
```

The default candidate threshold is configured in `config.json`:

```json
{
  "workTaskLimit": 3
}
```

A work category becomes a skill candidate when its task count is greater than this threshold and it has not already produced a potential skill.

## Manual CLI Usage

Agents normally run these commands through the installed SkillForSkill instructions. You can also run them manually:

```bash
node [absolute path to SkillForSkill]/main.js --- <command> [--key value]
```

Available commands:

```bash
node main.js --- list-works
node main.js --- list-works --includeFutureUnneededDiscardedWork true
node main.js --- list-work-candidates
node main.js --- list-potential-skills
node main.js --- get-work-skill-reference --workName <workName>
node main.js --- add-work --workName <workName> --description "<description>"
node main.js --- add-task --workName <workName> --taskName <taskName> --content "<taskContent>"
node main.js --- add-potential-skill --workName <workName> --skillName <skillName> --content "<skillMarkdown>"
node main.js --- discard-work --workName <workName> --isFutureWorkUnneeded false
```

CLI output is JSON.

## Notes

- `install.sh` and `uninstall.sh` are for macOS, Linux, WSL, or Git Bash.
- The installer overwrites Codex's installed `SkillForSkill` directory with the current project version.
- This project creates potential skill drafts; it does not publish or install those drafts automatically.
