# SkillForSkill

SkillForSkill helps Codex or Claude Code notice repeated work patterns and turn them into reusable skill candidates.

After each meaningful task, the installed SkillForSkill instructions guide the agent to:

- Decide whether the task is worth recording.
- Group similar tasks into reusable work categories.
- Track repeated tasks under `~/.SkillForSkillStorage`.
- Suggest a potential skill when a work category appears often enough.
- Respect user decisions to reject or stop prompting for certain skill ideas.

This project is an MVP. It records work samples and creates potential skill drafts, but it does not automatically install generated skill candidates.

## Requirements

- Node.js
- Codex or Claude Code
- macOS/Linux shell, WSL/Git Bash, or native Windows Command Prompt/PowerShell

No `npm install` or build step is required for normal use. The project currently uses only Node.js built-in modules and local files.

## Installation

Clone or download this repository, then run the installer for the agent you use.

### macOS, Linux, WSL, or Git Bash

Install for Codex:

```bash
./install.sh --target codex
```

Install for Claude Code:

```bash
./install.sh --target claude
```

If `--target` is omitted, the installer defaults to Codex:

```bash
./install.sh
```

### Windows

On native Windows, use the `.cmd` wrappers instead of the shell scripts.

1. Download the project ZIP from GitHub or clone the repository.
2. Install Node.js if it is not already installed.
3. Open Command Prompt or PowerShell in the project folder.
4. Run one of the installers below.

Install for Codex:

```bat
install-windows.cmd --target codex
```

Install for Claude Code:

```bat
install-windows.cmd --target claude
```

## What Installation Does

The installer generates `skills/SkillForSkill/SKILL.md` from `agent-operations.md`, replacing local placeholders with:

- The absolute path to this repository's `main.js`.
- The storage directory `~/.SkillForSkillStorage` or `%USERPROFILE%\.SkillForSkillStorage`.

Then it installs the generated skill into the selected agent:

| Target | Skill install path | Global instruction file |
| --- | --- | --- |
| Codex | `~/.codex/skills/SkillForSkill` | `~/.codex/config.toml` |
| Claude Code | `~/.claude/skills/SkillForSkill` | `~/.claude/CLAUDE.md` |

On Windows, the same paths are created under `%USERPROFILE%`.

The global instruction block is wrapped with SkillForSkill markers so uninstall can remove only the block it added.

After installing, restart Codex or Claude Code, or open a new session/thread, so the agent reloads skill metadata and global instructions.

## Uninstallation

### macOS, Linux, WSL, or Git Bash

Uninstall from Codex:

```bash
./uninstall.sh --target codex
```

Uninstall from Claude Code:

```bash
./uninstall.sh --target claude
```

If `--target` is omitted, uninstall defaults to Codex.

### Windows

Uninstall from Codex:

```bat
uninstall-windows.cmd --target codex
```

Uninstall from Claude Code:

```bat
uninstall-windows.cmd --target claude
```

Uninstall removes the installed `SkillForSkill` skill directory and removes the marked global instruction block. It does not delete `~/.SkillForSkillStorage` or `%USERPROFILE%\.SkillForSkillStorage`.

## Data Storage

SkillForSkill stores its data in:

```txt
~/.SkillForSkillStorage
```

On native Windows:

```txt
%USERPROFILE%\.SkillForSkillStorage
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
node /absolute/path/to/skill_candidate_detector/main.js --- <command> [--key value]
```

Available commands:

```bash
node main.js --- list-works
node main.js --- list-works --includeFutureUnneededDiscardedWork true
node main.js --- list-work-candidates
node main.js --- get-work-skill-reference --workName <workName>
node main.js --- add-work --workName <workName> --description "<description>"
node main.js --- add-task --workName <workName> --taskName <taskName> --content "<taskContent>"
node main.js --- add-potential-skill --workName <workName> --skillName <skillName> --content "<skillMarkdown>"
node main.js --- discard-work --workName <workName> --isFutureWorkUnneeded false
```

CLI output is JSON.

## Notes

- `install.sh` and `uninstall.sh` are for macOS, Linux, WSL, or Git Bash.
- `install-windows.cmd` and `uninstall-windows.cmd` are for native Windows.
- Installing for Codex and Claude Code is supported, but each target must be installed separately.
- The installer overwrites the selected agent's installed `SkillForSkill` directory with the current project version.
- This project creates potential skill drafts; it does not publish or install those drafts automatically.
