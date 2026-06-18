#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const BEGIN_MARKER = "[SkillForSkill global instructions begin]";
const END_MARKER = "[SkillForSkill global instructions end]";

const GLOBAL_INSTRUCTIONS = [
  BEGIN_MARKER,
  "After completing any meaningful user task, use the `SkillForSkill` skill if it is available.",
  "",
  "The first SkillForSkill step is to find a usable SkillForSkill server URL with the scoped client before recording the task. Reading the skill without server discovery is incomplete.",
  "",
  "If `SkillForSkill` is not available in the current Claude Code session, and the current workspace contains `agent-operations.md`, follow that file directly before sending the final response.",
  "",
  "Skip this flow only when the interaction is pure conversation, the user explicitly asks not to use SkillForSkill or not to record the task, or the task is not complete.",
  END_MARKER,
].join("\n");

function usage() {
  throw new Error("Usage: update-claude-memory.js <install|uninstall> <memoryPath>");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function installGlobalInstructions(text) {
  if (text.includes(BEGIN_MARKER)) {
    return { changed: false, text };
  }

  if (text.trim() === "") {
    return { changed: true, text: `${GLOBAL_INSTRUCTIONS}\n` };
  }

  return {
    changed: true,
    text: `${text.replace(/\s+$/g, "")}\n\n${GLOBAL_INSTRUCTIONS}\n`,
  };
}

function uninstallGlobalInstructions(text) {
  if (!text.includes(BEGIN_MARKER)) {
    return { changed: false, text };
  }

  const markerPattern = new RegExp(
    `\\n*${escapeRegExp(BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n*`,
    "m",
  );
  const nextText = text
    .replace(markerPattern, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");

  return {
    changed: true,
    text: nextText ? `${nextText}\n` : "",
  };
}

function main() {
  const [action, memoryPath] = process.argv.slice(2);

  if (!["install", "uninstall"].includes(action) || !memoryPath) {
    usage();
  }

  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });

  const originalText = fs.existsSync(memoryPath)
    ? fs.readFileSync(memoryPath, "utf8")
    : "";
  const result =
    action === "install"
      ? installGlobalInstructions(originalText)
      : uninstallGlobalInstructions(originalText);

  if (result.changed) {
    fs.writeFileSync(memoryPath, result.text, "utf8");
  } else if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(memoryPath, "", "utf8");
  }

  console.log(
    result.changed
      ? `${action}ed SkillForSkill global instructions in ${memoryPath}`
      : `SkillForSkill global instructions already ${action === "install" ? "installed" : "removed"} in ${memoryPath}`,
  );
}

main();
