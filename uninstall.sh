#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="SkillForSkill"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_CONFIG_PATH="${HOME}/.codex/config.toml"
CLAUDE_MEMORY_PATH="${HOME}/.claude/CLAUDE.md"
CODEX_CONFIG_HELPER="${SCRIPT_DIR}/scripts/update-codex-config.js"
CLAUDE_MEMORY_HELPER="${SCRIPT_DIR}/scripts/update-claude-memory.js"
TARGET="codex"

usage() {
  cat >&2 <<'EOF'
Usage: ./uninstall.sh [--target codex|claude]

Targets:
  codex   Uninstall SkillForSkill from Codex (default)
  claude  Uninstall SkillForSkill from Claude Code
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

if [[ "${TARGET}" == "codex" && ! -f "${CODEX_CONFIG_HELPER}" ]]; then
  echo "Missing config helper: ${CODEX_CONFIG_HELPER}" >&2
  exit 1
fi

if [[ "${TARGET}" == "claude" && ! -f "${CLAUDE_MEMORY_HELPER}" ]]; then
  echo "Missing Claude memory helper: ${CLAUDE_MEMORY_HELPER}" >&2
  exit 1
fi

if [[ "${TARGET}" == "codex" ]]; then
  USER_SKILL_DIR="${HOME}/.codex/skills/${SKILL_NAME}"

  if [[ -d "${USER_SKILL_DIR}" ]]; then
    rm -rf "${USER_SKILL_DIR}"
    echo "Uninstalled ${SKILL_NAME} from ${USER_SKILL_DIR}"
  else
    echo "${SKILL_NAME} skill directory is already uninstalled."
  fi

  node "${CODEX_CONFIG_HELPER}" uninstall "${CODEX_CONFIG_PATH}" "${SCRIPT_DIR}"

  echo "Codex config: ${CODEX_CONFIG_PATH}"
  echo "Restart Codex and open a new thread to reload skill metadata and global instructions."
  exit 0
fi

USER_SKILL_DIR="${HOME}/.claude/skills/${SKILL_NAME}"

if [[ -d "${USER_SKILL_DIR}" ]]; then
  rm -rf "${USER_SKILL_DIR}"
  echo "Uninstalled ${SKILL_NAME} from ${USER_SKILL_DIR}"
else
  echo "${SKILL_NAME} skill directory is already uninstalled."
fi

node "${CLAUDE_MEMORY_HELPER}" uninstall "${CLAUDE_MEMORY_PATH}"

echo "Claude memory: ${CLAUDE_MEMORY_PATH}"
echo "Claude memory file is left in place even if it is empty."
echo "Restart Claude Code and open a new session to reload skill metadata and global instructions."
