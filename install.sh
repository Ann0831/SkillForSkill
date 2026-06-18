#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="SkillForSkill"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATED_SKILLS_DIR="${SCRIPT_DIR}/skills"
PROJECT_SKILL_DIR="${GENERATED_SKILLS_DIR}/${SKILL_NAME}"
SOURCE_DOC="${SCRIPT_DIR}/agent-operations.md"
TARGET_SKILL_MD="${PROJECT_SKILL_DIR}/SKILL.md"
SERVER_ENTRYPOINT="${SCRIPT_DIR}/server.js"
SERVER_CONTRACT_PATH="${SCRIPT_DIR}/server-contract.json"
DATA_DIR="${HOME}/.SkillForSkillStorage"
CODEX_CONFIG_PATH="${HOME}/.codex/config.toml"
CLAUDE_MEMORY_PATH="${HOME}/.claude/CLAUDE.md"
CODEX_CONFIG_HELPER="${SCRIPT_DIR}/scripts/update-codex-config.js"
CLAUDE_MEMORY_HELPER="${SCRIPT_DIR}/scripts/update-claude-memory.js"
TARGET="codex"

usage() {
  cat >&2 <<'EOF'
Usage: ./install.sh [--target codex|claude]

Targets:
  codex   Install SkillForSkill for Codex (default)
  claude  Install SkillForSkill for Claude Code
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      if [[ $# -lt 2 ]]; then
        usage
        exit 1
      fi
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#--target=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [[ "${TARGET}" != "codex" && "${TARGET}" != "claude" ]]; then
  usage
  exit 1
fi

if [[ ! -f "${SOURCE_DOC}" ]]; then
  echo "Missing source doc: ${SOURCE_DOC}" >&2
  exit 1
fi

if [[ ! -f "${SERVER_ENTRYPOINT}" ]]; then
  echo "Missing server entrypoint: ${SERVER_ENTRYPOINT}" >&2
  exit 1
fi

if [[ ! -f "${SERVER_CONTRACT_PATH}" ]]; then
  echo "Missing server contract: ${SERVER_CONTRACT_PATH}" >&2
  exit 1
fi

if [[ "${TARGET}" == "codex" && ! -f "${CODEX_CONFIG_HELPER}" ]]; then
  echo "Missing config helper: ${CODEX_CONFIG_HELPER}" >&2
  exit 1
fi

if [[ "${TARGET}" == "claude" && ! -f "${CLAUDE_MEMORY_HELPER}" ]]; then
  echo "Missing Claude memory helper: ${CLAUDE_MEMORY_HELPER}" >&2
  exit 1
fi

mkdir -p "${PROJECT_SKILL_DIR}"

cat > "${TARGET_SKILL_MD}" <<'EOF'
---
name: SkillForSkill
description: Use at the end of every meaningful user task that produced code, files, analysis, commands, debugging, implementation, documentation, or other task output, to record the task in SkillForSkill, classify work, add tasks, evaluate skill candidates, create potential skills, or process user confirmation about suggested skills.
---

EOF

project_dir_replacement="${SCRIPT_DIR//&/\\&}"
node - "${SOURCE_DOC}" "${project_dir_replacement}" "${SERVER_CONTRACT_PATH}" "${DATA_DIR}" <<'NODE' >> "${TARGET_SKILL_MD}"
const fs = require("fs");

const [sourceDoc, projectDir, serverContractPath, dataDir] = process.argv.slice(2);
const sourceText = fs.readFileSync(sourceDoc, "utf8");
const serverContract = require(serverContractPath);
const serverUrls = serverContract.ports
  .map((port) => `http://${serverContract.host}:${port}`)
  .join("\n");

process.stdout.write(
  sourceText
    .split("__SKILLFORSKILL_PROJECT_DIR__").join(projectDir)
    .split("__SKILLFORSKILL_SERVER_URLS__").join(serverUrls)
    .split("__SKILLFORSKILL_DATA_DIR__").join(dataDir),
);
NODE

if [[ "${TARGET}" == "codex" ]]; then
  USER_SKILLS_DIR="${HOME}/.codex/skills"
  USER_SKILL_DIR="${USER_SKILLS_DIR}/${SKILL_NAME}"

  mkdir -p "${USER_SKILLS_DIR}"
  rm -rf "${USER_SKILL_DIR}"
  cp -R "${PROJECT_SKILL_DIR}" "${USER_SKILLS_DIR}/"
  node "${CODEX_CONFIG_HELPER}" install "${CODEX_CONFIG_PATH}"
  rm -rf "${GENERATED_SKILLS_DIR}"

  echo "Installed ${SKILL_NAME} to ${USER_SKILL_DIR}"
  echo "Removed generated project skill directory: ${GENERATED_SKILLS_DIR}"
  echo "Server entrypoint: ${SERVER_ENTRYPOINT}"
  echo "REST server contract: ${SERVER_CONTRACT_PATH}"
  echo "Data directory: ${DATA_DIR}"
  echo "Codex config: ${CODEX_CONFIG_PATH}"
  echo "Restart Codex or open a new thread to reload skill metadata and global instructions."
  exit 0
fi

USER_SKILLS_DIR="${HOME}/.claude/skills"
USER_SKILL_DIR="${USER_SKILLS_DIR}/${SKILL_NAME}"

mkdir -p "${USER_SKILLS_DIR}"
rm -rf "${USER_SKILL_DIR}"
cp -R "${PROJECT_SKILL_DIR}" "${USER_SKILLS_DIR}/"
node "${CLAUDE_MEMORY_HELPER}" install "${CLAUDE_MEMORY_PATH}"
rm -rf "${GENERATED_SKILLS_DIR}"

echo "Installed ${SKILL_NAME} to ${USER_SKILL_DIR}"
echo "Removed generated project skill directory: ${GENERATED_SKILLS_DIR}"
echo "Server entrypoint: ${SERVER_ENTRYPOINT}"
echo "REST server contract: ${SERVER_CONTRACT_PATH}"
echo "Data directory: ${DATA_DIR}"
echo "Claude memory: ${CLAUDE_MEMORY_PATH}"
echo "Restart Claude Code or open a new session to reload skill metadata and global instructions."
