# SkillForSkill REST API Commands

This file defines the REST API commands agents can use when operating the `SkillForSkill` MVP. Agents should use the installed `SkillForSkill/SKILL.md` as the runtime source of truth after installation.

## Start The Server

Install dependencies once:

```bash
npm install
```

Start the REST server from the `SkillForSkill` project directory:

```bash
npm start
```

Agents can also start the server entrypoint directly:

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

Agents should normally use the scoped client instead of direct `curl` calls:

```bash
node scripts/skillforskill-client.js ensure-server
```

The client checks the fallback URL contract, starts `server.js` if needed, and only talks to `127.0.0.1` contract ports. In approval-based environments, request persistent approval for this narrow command prefix:

```txt
node <SkillForSkill project>/scripts/skillforskill-client.js
```

Raw REST calls are still documented below for humans and debugging. Use the first fallback URL whose health check identifies `SkillForSkill` as `SELECTED_SKILLFORSKILL_SERVER_URL`.

## Health Check

Before sending commands, agents should verify that the port is connected to SkillForSkill:

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

The scoped client performs this check automatically. For raw REST debugging, check fallback URLs in order and treat the server as valid only when the HTTP status is `200`, `ok` is `true`, and `service` is `SkillForSkill`. If a check succeeds, use that URL as `SELECTED_SKILLFORSKILL_SERVER_URL`. If all checks fail, the server is not running or all contract ports are unavailable.

## User Space

Users can inspect recorded work, tasks, and potential skills in a browser:

```txt
${SELECTED_SKILLFORSKILL_SERVER_URL}/user-space
```

Detail routes use query parameters:

```txt
/user-space/work?workName=<workName>&source=work
/user-space/task?workName=<workName>&taskName=<task.md>&source=work
/user-space/potential-skill?skillName=<skill.md>
```

The frontend uses `GET /api/health` and `GET /api/read` only.

## Request Format

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

For browser-style reads, `GET /api/read` also accepts query parameters:

```txt
/api/read?command=list-works&args=%7B%22includeFutureUnneededDiscardedWork%22%3Atrue%7D
```

`args` must be URL-encoded JSON and defaults to `{}` when omitted.

Responses use this shape on success:

```json
{
  "ok": true,
  "result": []
}
```

Errors use this shape:

```json
{
  "ok": false,
  "error": "command must be a non-empty string."
}
```

Agents must send read commands only to `GET /api/read` and write commands only to `POST /api/write`.

Preferred client format:

```bash
node scripts/skillforskill-client.js read list-works '{"includeFutureUnneededDiscardedWork":true}'
node scripts/skillforskill-client.js write add-work '{"workName":"debugging","description":"Handle debugging tasks and similar work that can be investigated through repeatable steps."}'
```

## Read Commands

### `list-works`

Reads the current work folders under `work/`, allowing the agent to decide whether a new task should be added to an existing work folder or whether a new work folder is needed.

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-works","args":{}}'
```

By default, this lists only work folders under `work/` and does not read `discarded_work/`.

To also read discarded work that the user has marked as unnecessary for future handling, use:

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-works","args":{"includeFutureUnneededDiscardedWork":true}}'
```

This parameter only additionally lists work in `discarded_work/` where `isFutureWorkUnneeded: true`; discarded work where `isFutureWorkUnneeded: false` is not listed.

Each returned work includes:

- `workName`
- `workDir`
- `description`
- `taskCount`
- `taskFiles`
- `hasPotentialSkill`
- `potentialSkillName`
- `isDiscarded`
- `isFutureWorkUnneeded`

### `list-work-candidates`

Lists work types under `work/` that have exceeded the task-count threshold and do not yet have a potential skill.

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-work-candidates","args":{}}'
```

Results are sorted by work folder creation time from oldest to newest. If creation times are equal, results are sorted by `workName`.

Use `taskLimit` to override `workTaskLimit` from `config.json`:

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-work-candidates","args":{"taskLimit":5}}'
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

### `list-potential-skills`

Lists all potential skill Markdown draft paths under `potential_skill/`.

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-potential-skills","args":{}}'
```

By default, this reads `~/.SkillForSkillStorage/potential_skill/`. Use `rootDir` only for tests or special storage locations:

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"list-potential-skills","args":{"rootDir":"/tmp/test-skill-data"}}'
```

If the `potential_skill/` folder does not exist, the command returns an empty array and does not create the folder.

Returns a sorted JSON array of Markdown file paths inside `result`:

```json
{
  "ok": true,
  "result": [
    "/Users/example/.SkillForSkillStorage/potential_skill/example-a.md",
    "/Users/example/.SkillForSkillStorage/potential_skill/example-b.md"
  ]
}
```

### `get-work-skill-reference`

Reads the full content of an active work and builds reference text the agent can use to generate a skill.

```bash
curl -sS -X GET "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/read" \
  -H 'Content-Type: application/json' \
  -d '{"command":"get-work-skill-reference","args":{"workName":"debugging"}}'
```

Effects:

- Reads only `~/.SkillForSkillStorage/work/<workName>/`.
- Reads `description.md`.
- Reads all task Markdown files in sorted order.
- Combines the work name, description, and all task content into `referenceText`.

Returns inside `result`:

- `workName`
- `workDir`
- `description`
- `taskFiles`
- `referenceText`

### `get-work`

Reads one active or discarded work without reading every task body.

```txt
/api/read?command=get-work&args=%7B%22workName%22%3A%22debugging%22%2C%22source%22%3A%22work%22%7D
```

`source` must be `work` or `discarded_work` and defaults to `work`.

Returns inside `result`:

- `workName`
- `source`
- `workDir`
- `description`
- `state`
- `taskFiles`
- `taskCount`
- `hasPotentialSkill`
- `potentialSkillName`
- `isFutureWorkUnneeded`
- `isSkillCandidate`

### `get-task`

Reads one task Markdown file from an active or discarded work.

```txt
/api/read?command=get-task&args=%7B%22workName%22%3A%22debugging%22%2C%22taskName%22%3A%22task-001.md%22%2C%22source%22%3A%22work%22%7D
```

Returns inside `result`:

- `workName`
- `source`
- `workDir`
- `taskName`
- `taskPath`
- `content`

### `get-potential-skill`

Reads one potential skill Markdown draft.

```txt
/api/read?command=get-potential-skill&args=%7B%22skillName%22%3A%22error-debugging-helper.md%22%7D
```

Returns inside `result`:

- `skillName`
- `skillPath`
- `content`

## Write Commands

### `add-work`

Adds a work folder and ensures the folder contains `description.md` and `state.json`.

```bash
curl -sS -X POST "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/write" \
  -H 'Content-Type: application/json' \
  -d '{"command":"add-work","args":{"workName":"debugging","description":"Handle debugging tasks and similar work that can be investigated through repeatable steps."}}'
```

Effects:

- Creates `~/.SkillForSkillStorage/work/<workName>/`.
- Creates `~/.SkillForSkillStorage/work/<workName>/description.md` if it does not exist.
- Creates `~/.SkillForSkillStorage/work/<workName>/state.json` if it does not exist.
- Does not overwrite existing `description.md`.
- Defaults `state.json` to `{ "hasPotentialSkill": false }`.

### `add-task`

Adds a task Markdown file to the specified work.

```bash
curl -sS -X POST "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/write" \
  -H 'Content-Type: application/json' \
  -d '{"command":"add-task","args":{"workName":"debugging","taskName":"task-001","content":"# Task"}}'
```

Effects:

- Creates or uses `~/.SkillForSkillStorage/work/<workName>/`.
- Ensures `state.json` exists.
- Adds `~/.SkillForSkillStorage/work/<workName>/<taskName>.md`.
- If a task file with the same name already exists, the command fails and must not overwrite the existing task.

### `add-potential-skill`

Adds a potential skill Markdown file and marks the source work as having produced a potential skill.

```bash
curl -sS -X POST "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/write" \
  -H 'Content-Type: application/json' \
  -d '{"command":"add-potential-skill","args":{"workName":"debugging","skillName":"error-debugging-helper","content":"# error-debugging-helper"}}'
```

Effects:

- Confirms that `~/.SkillForSkillStorage/work/<workName>/` exists.
- Creates or uses `~/.SkillForSkillStorage/potential_skill/`.
- Adds `~/.SkillForSkillStorage/potential_skill/<skillName>.md`.
- Sets `hasPotentialSkill` to `true` in `~/.SkillForSkillStorage/work/<workName>/state.json`.
- If a skill file with the same name already exists, the command fails and must not overwrite the existing recommendation.
- If potential skill creation fails, the work state is not updated.

### `discard-work`

Moves the specified work from `work/` to `discarded_work/`, preserving work types that have been judged unsuitable for conversion into a skill.

```bash
curl -sS -X POST "${SELECTED_SKILLFORSKILL_SERVER_URL}/api/write" \
  -H 'Content-Type: application/json' \
  -d '{"command":"discard-work","args":{"workName":"debugging","isFutureWorkUnneeded":true}}'
```

Effects:

- Moves the entire folder from `~/.SkillForSkillStorage/work/<workName>/`.
- Moves it to `~/.SkillForSkillStorage/discarded_work/<workName>/`.
- Updates `isFutureWorkUnneeded` in `discarded_work/<workName>/state.json`.
- `isFutureWorkUnneeded` must be `true` or `false`.
- If the source work does not exist, the command fails.
- If the target discarded work already exists, the command fails and must not overwrite existing data.

Returns inside `result`:

- `workDir`
- `discardedWorkDir`
- `statePath`
