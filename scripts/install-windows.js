#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SKILL_NAME = "SkillForSkill";
const REPO_ROOT = path.resolve(__dirname, "..");
const GENERATED_SKILLS_DIR = path.join(REPO_ROOT, "skills");
const PROJECT_SKILL_DIR = path.join(GENERATED_SKILLS_DIR, SKILL_NAME);
const SOURCE_DOC = path.join(REPO_ROOT, "agent-operations.md");
const TARGET_SKILL_MD = path.join(PROJECT_SKILL_DIR, "SKILL.md");
const SERVER_ENTRYPOINT = path.join(REPO_ROOT, "server.js");
const SERVER_CONTRACT_PATH = path.join(REPO_ROOT, "server-contract.json");
const HOME_DIR = process.env.USERPROFILE || os.homedir();
const DATA_DIR = path.join(HOME_DIR, ".SkillForSkillStorage");
const CODEX_CONFIG_PATH = path.join(HOME_DIR, ".codex", "config.toml");
const CLAUDE_MEMORY_PATH = path.join(HOME_DIR, ".claude", "CLAUDE.md");
const CODEX_CONFIG_HELPER = path.join(REPO_ROOT, "scripts", "update-codex-config.js");
const CLAUDE_MEMORY_HELPER = path.join(REPO_ROOT, "scripts", "update-claude-memory.js");

function usage() {
  console.error(`Usage: install-windows.cmd [--target codex|claude]

Targets:
  codex   Install SkillForSkill for Codex (default)
  claude  Install SkillForSkill for Claude Code`);
}

function parseTarget(argv) {
  let target = "codex";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--target") {
      if (index + 1 >= argv.length) {
        usage();
        process.exit(1);
      }
      target = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
    } else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else {
      usage();
      process.exit(1);
    }
  }

  if (!["codex", "claude"].includes(target)) {
    usage();
    process.exit(1);
  }

  return target;
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    console.error(`Missing ${label}: ${filePath}`);
    process.exit(1);
  }
}

function replaceAllText(text, searchValue, replacementValue) {
  return text.split(searchValue).join(replacementValue);
}

function generateSkillFile() {
  fs.mkdirSync(PROJECT_SKILL_DIR, { recursive: true });

  const frontmatter = [
    "---",
    "name: SkillForSkill",
    "description: Use at the end of every meaningful user task that produced code, files, analysis, commands, debugging, implementation, documentation, or other task output, to record the task in SkillForSkill, classify work, add tasks, evaluate skill candidates, create potential skills, or process user confirmation about suggested skills.",
    "---",
    "",
  ].join("\n");

  const sourceText = fs.readFileSync(SOURCE_DOC, "utf8");
  const serverContract = JSON.parse(fs.readFileSync(SERVER_CONTRACT_PATH, "utf8"));
  const serverUrls = serverContract.ports
    .map((port) => `http://${serverContract.host}:${port}`)
    .join("\n");
  const body = replaceAllText(
    replaceAllText(
      replaceAllText(sourceText, "__SKILLFORSKILL_PROJECT_DIR__", REPO_ROOT),
      "__SKILLFORSKILL_SERVER_URLS__",
      serverUrls,
    ),
    "__SKILLFORSKILL_DATA_DIR__",
    DATA_DIR,
  );

  fs.writeFileSync(TARGET_SKILL_MD, `${frontmatter}${body}`, "utf8");
}

function copySkillTo(userSkillsDir) {
  const userSkillDir = path.join(userSkillsDir, SKILL_NAME);

  fs.mkdirSync(userSkillsDir, { recursive: true });
  fs.rmSync(userSkillDir, { recursive: true, force: true });
  fs.cpSync(PROJECT_SKILL_DIR, userSkillDir, { recursive: true });

  return userSkillDir;
}

function removeGeneratedProjectSkills() {
  fs.rmSync(GENERATED_SKILLS_DIR, { recursive: true, force: true });
  console.log(`Removed generated project skill directory: ${GENERATED_SKILLS_DIR}`);
}

function runHelper(helperPath, action, targetPath) {
  const result = spawnSync(process.execPath, [helperPath, action, targetPath], {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const target = parseTarget(process.argv.slice(2));

  requireFile(SOURCE_DOC, "source doc");
  requireFile(SERVER_ENTRYPOINT, "server entrypoint");
  requireFile(SERVER_CONTRACT_PATH, "server contract");
  requireFile(
    target === "codex" ? CODEX_CONFIG_HELPER : CLAUDE_MEMORY_HELPER,
    target === "codex" ? "config helper" : "Claude memory helper",
  );

  generateSkillFile();

  if (target === "codex") {
    const userSkillDir = copySkillTo(path.join(HOME_DIR, ".codex", "skills"));
    runHelper(CODEX_CONFIG_HELPER, "install", CODEX_CONFIG_PATH);
    removeGeneratedProjectSkills();

    console.log(`Installed ${SKILL_NAME} to ${userSkillDir}`);
    console.log(`Server entrypoint: ${SERVER_ENTRYPOINT}`);
    console.log(`REST server contract: ${SERVER_CONTRACT_PATH}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Codex config: ${CODEX_CONFIG_PATH}`);
    console.log("Restart Codex and open a new thread to reload skill metadata and global instructions.");
    return;
  }

  const userSkillDir = copySkillTo(path.join(HOME_DIR, ".claude", "skills"));
  runHelper(CLAUDE_MEMORY_HELPER, "install", CLAUDE_MEMORY_PATH);
  removeGeneratedProjectSkills();

  console.log(`Installed ${SKILL_NAME} to ${userSkillDir}`);
  console.log(`Server entrypoint: ${SERVER_ENTRYPOINT}`);
  console.log(`REST server contract: ${SERVER_CONTRACT_PATH}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Claude memory: ${CLAUDE_MEMORY_PATH}`);
  console.log("Restart Claude Code and open a new session to reload skill metadata and global instructions.");
}

main();
