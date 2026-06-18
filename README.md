# SkillForSkill

SkillForSkill helps Codex record meaningful completed tasks and turn accumulated work into skill candidates.

After each meaningful task, the installed SkillForSkill instructions guide the agent to:

- Record the task unless a basic skip condition applies.
- Group related tasks into stable work categories.
- Track recorded tasks under `~/.SkillForSkillStorage`.
- Suggest a potential skill when a work category appears often enough.
- Respect user decisions to reject or stop prompting for certain skill ideas.

This project is still in its early stages. It records work samples and creates potential skill drafts.

Feedback and suggestions are welcome. Feel free to open an issue or contact me at chenian20454@gmail.com.

## Requirements

- Node.js
- npm
- Codex
- macOS/Linux shell, WSL, or Git Bash

Run `npm install` before starting the REST server.

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

- The absolute path to this repository.
- The default REST server URL.
- The storage directory `~/.SkillForSkillStorage`.

Then it installs the generated skill into Codex and removes the temporary project `skills/` directory after the copy and config update succeed:

| Target | Skill install path | Global instruction file |
| --- | --- | --- |
| Codex | `~/.codex/skills/SkillForSkill` | `~/.codex/config.toml` |

The global instruction block is wrapped with SkillForSkill markers so uninstall can remove only the block it added.

The repository's `skills/` directory is an install-time generated artifact. It is not kept in the project after a successful install; the runtime copy lives under the target user's skill directory.

After installing, restart Codex and open a new thread, so the agent reloads skill metadata and global instructions.

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

## REST Server Usage

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

This runs:

```bash
node server.js
```

By default, the server reads `server-contract.json` and listens on the first available fallback URL:

```txt
http://127.0.0.1:3000
http://127.0.0.1:3001
http://127.0.0.1:3002
http://127.0.0.1:3003
http://127.0.0.1:3004
```

Agents should use the scoped client for normal server discovery and command calls:

```bash
node scripts/skillforskill-client.js ensure-server
```

The client checks the fallback URLs from `server-contract.json`, starts `server.js` if needed, and prints the selected server URL. In approval-based environments, agents should request persistent approval for the narrow command prefix:

```txt
node <SkillForSkill project>/scripts/skillforskill-client.js
```

For manual debugging, verify which fallback URL is connected to SkillForSkill:

```bash
curl -sS http://127.0.0.1:3000/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "SkillForSkill",
  "mode": "rest",
  "version": "0.0.0"
}
```

If this check fails, try the next fallback URL from `server-contract.json`. If all checks fail, the server is not running or all contract ports are unavailable.

Open the user-facing workspace in a browser:

```txt
<selected-server-url>/user-space
```

The top bar includes a `Close server` link to:

```txt
<selected-server-url>/pid
```

This page shows the running server process ID, so you can close a background server manually with your operating system's process tools.

Detail pages use URL parameters:

```txt
<selected-server-url>/user-space/work?workName=<workName>&source=work
<selected-server-url>/user-space/task?workName=<workName>&taskName=<task.md>&source=work
<selected-server-url>/user-space/potential-skill?skillName=<skill.md>
```

SkillForSkill exposes exactly two command endpoints:

| Method | Endpoint | Command type |
| --- | --- | --- |
| GET | `/api/read` | Read commands |
| POST | `/api/write` | Write commands |

Both endpoints use a JSON request body:

```json
{
  "command": "list-works",
  "args": {}
}
```

Browser pages can also call the read endpoint with query parameters:

```txt
GET /api/read?command=list-works&args=%7B%22includeFutureUnneededDiscardedWork%22%3Atrue%7D
```

Available read commands:

- `list-works`
- `list-work-candidates`
- `list-potential-skills`
- `get-work-skill-reference`
- `get-work`
- `get-task`
- `get-potential-skill`

Available write commands:

- `add-work`
- `add-task`
- `add-potential-skill`
- `discard-work`

Preferred agent read:

```bash
node scripts/skillforskill-client.js read list-works '{"includeFutureUnneededDiscardedWork":true}'
```

Preferred agent write:

```bash
node scripts/skillforskill-client.js write add-work '{"workName":"debugging","description":"Handle debugging tasks and similar work that can be investigated through repeatable steps."}'
```

Raw REST read:

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-works","args":{"includeFutureUnneededDiscardedWork":true}}'
```

Raw REST write:

```bash
curl -sS -X POST "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/write" \
  -H 'Content-Type: application/json' \
  -d '{"command":"add-work","args":{"workName":"debugging","description":"Handle debugging tasks and similar work that can be investigated through repeatable steps."}}'
```

Responses are JSON.

## Notes

- `install.sh` and `uninstall.sh` are for macOS, Linux, WSL, or Git Bash.
- The installer overwrites Codex's installed `SkillForSkill` directory with the current project version.
- This project creates potential skill drafts; it does not publish or install those drafts automatically.
