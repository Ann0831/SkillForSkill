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
  "If `SkillForSkill` is not available in the current Codex session, and the current workspace contains `agent-operations.md`, follow that file directly before sending the final response.",
  "",
  "Skip this flow only when the interaction is pure conversation, the user explicitly asks not to use SkillForSkill or not to record the task, or the task is not complete.",
  END_MARKER,
].join("\n");

function usage() {
  throw new Error("Usage: update-codex-config.js <install|uninstall> <configPath> [projectPath]");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstTableIndex(text) {
  const match = text.match(/^[ \t]*\[/m);
  return match ? match.index : text.length;
}

function findDeveloperInstructions(text) {
  const topLevelEnd = findFirstTableIndex(text);
  const topLevelText = text.slice(0, topLevelEnd);
  const match = topLevelText.match(/^developer_instructions[ \t]*=/m);

  if (!match) {
    return null;
  }

  const assignmentStart = match.index;
  let valueStart = assignmentStart + match[0].length;

  while (valueStart < text.length && /[ \t]/.test(text[valueStart])) {
    valueStart += 1;
  }

  if (text.slice(valueStart, valueStart + 3) !== '"""') {
    throw new Error(
      "Unsupported developer_instructions format. Expected a top-level multiline basic string.",
    );
  }

  const bodyStart = valueStart + 3;
  const bodyEnd = text.indexOf('"""', bodyStart);

  if (bodyEnd === -1) {
    throw new Error("Malformed developer_instructions: missing closing triple quotes.");
  }

  let assignmentEnd = bodyEnd + 3;

  while (assignmentEnd < text.length && /[ \t]/.test(text[assignmentEnd])) {
    assignmentEnd += 1;
  }

  if (text[assignmentEnd] === "\r" && text[assignmentEnd + 1] === "\n") {
    assignmentEnd += 2;
  } else if (text[assignmentEnd] === "\n") {
    assignmentEnd += 1;
  }

  return {
    assignmentEnd,
    assignmentStart,
    body: text.slice(bodyStart, bodyEnd),
  };
}

function formatDeveloperInstructions(body) {
  const normalizedBody = body.replace(/^\n+|\n+$/g, "");
  return `developer_instructions = """\n${normalizedBody}\n"""\n`;
}

function insertDeveloperInstructions(text, body) {
  const assignment = formatDeveloperInstructions(body);

  if (text.trim() === "") {
    return `${assignment}`;
  }

  const tableIndex = findFirstTableIndex(text);
  const topLevelText = text.slice(0, tableIndex).replace(/\s+$/g, "");
  const rest = text.slice(tableIndex).replace(/^\n+/, "");
  const prefix = topLevelText ? `${topLevelText}\n\n` : "";
  const suffix = rest ? `\n${rest}` : "";

  return `${prefix}${assignment}${suffix}`;
}

function installGlobalInstructions(text) {
  const developerInstructions = findDeveloperInstructions(text);

  if (!developerInstructions) {
    return {
      changed: true,
      text: insertDeveloperInstructions(text, GLOBAL_INSTRUCTIONS),
    };
  }

  if (developerInstructions.body.includes(BEGIN_MARKER)) {
    return { changed: false, text };
  }

  const nextBody = developerInstructions.body.trim()
    ? `${developerInstructions.body.replace(/\n+$/g, "")}\n\n${GLOBAL_INSTRUCTIONS}`
    : GLOBAL_INSTRUCTIONS;
  const nextAssignment = formatDeveloperInstructions(nextBody);

  return {
    changed: true,
    text: `${text.slice(0, developerInstructions.assignmentStart)}${nextAssignment}${text.slice(
      developerInstructions.assignmentEnd,
    )}`,
  };
}

function uninstallGlobalInstructions(text) {
  const developerInstructions = findDeveloperInstructions(text);

  if (!developerInstructions || !developerInstructions.body.includes(BEGIN_MARKER)) {
    return { changed: false, text };
  }

  const markerPattern = new RegExp(
    `\\n*${escapeRegExp(BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n*`,
    "m",
  );
  const nextBody = developerInstructions.body.replace(markerPattern, "\n").replace(/^\n+|\n+$/g, "");

  if (nextBody.trim() === "") {
    const before = text.slice(0, developerInstructions.assignmentStart).replace(/[ \t]*$/g, "");
    const after = text.slice(developerInstructions.assignmentEnd).replace(/^\n+/, "");
    const separator = before && after ? "\n\n" : "";

    return {
      changed: true,
      text: `${before}${separator}${after}`,
    };
  }

  const nextAssignment = formatDeveloperInstructions(nextBody);

  return {
    changed: true,
    text: `${text.slice(0, developerInstructions.assignmentStart)}${nextAssignment}${text.slice(
      developerInstructions.assignmentEnd,
    )}`,
  };
}

function escapeTomlBasicString(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\b]/g, "\\b")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\f/g, "\\f")
    .replace(/\r/g, "\\r");
}

function findTomlTables(text) {
  const tables = [];
  const tablePattern = /^[ \t]*\[([^\]\r\n]+)\][ \t]*(?:#.*)?(?:\r?\n|$)/gm;
  let match;

  while ((match = tablePattern.exec(text)) !== null) {
    tables.push({
      end: match.index + match[0].length,
      name: match[1],
      start: match.index,
    });
  }

  return tables.map((table, index) => ({
    ...table,
    nextStart: index + 1 < tables.length ? tables[index + 1].start : text.length,
  }));
}

function removeCodexProjectTrust(text, projectPath) {
  if (!projectPath) {
    return { changed: false, text };
  }

  const projectTableName = `projects."${escapeTomlBasicString(projectPath)}"`;
  const projectTable = findTomlTables(text).find((table) => table.name === projectTableName);

  if (!projectTable) {
    return { changed: false, text };
  }

  const tableBody = text.slice(projectTable.end, projectTable.nextStart);
  const trustPattern = /^[ \t]*trust_level[ \t]*=[ \t]*"trusted"[ \t]*(?:#.*)?(?:\r?\n|$)/m;

  if (!trustPattern.test(tableBody)) {
    return { changed: false, text };
  }

  const nextBody = tableBody.replace(trustPattern, "");

  if (nextBody.trim() === "") {
    const before = text.slice(0, projectTable.start).replace(/[ \t]*$/g, "");
    const after = text.slice(projectTable.nextStart).replace(/^\n+/, "");
    const separator = before && after ? "\n\n" : "";

    return {
      changed: true,
      text: `${before}${separator}${after}`,
    };
  }

  return {
    changed: true,
    text: `${text.slice(0, projectTable.end)}${nextBody}${text.slice(projectTable.nextStart)}`,
  };
}

function main() {
  const [action, configPath, projectPath] = process.argv.slice(2);

  if (!["install", "uninstall"].includes(action) || !configPath) {
    usage();
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  const originalText = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, "utf8")
    : "";
  const instructionsResult =
    action === "install"
      ? installGlobalInstructions(originalText)
      : uninstallGlobalInstructions(originalText);
  const result =
    action === "uninstall"
      ? removeCodexProjectTrust(instructionsResult.text, projectPath)
      : { changed: false, text: instructionsResult.text };
  const changed = instructionsResult.changed || result.changed;

  if (changed) {
    fs.writeFileSync(configPath, result.text, "utf8");
  }

  console.log(
    changed
      ? `${action}ed SkillForSkill Codex config entries in ${configPath}`
      : `SkillForSkill Codex config entries already ${action === "install" ? "installed" : "removed"} in ${configPath}`,
  );
}

main();
