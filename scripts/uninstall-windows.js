#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SKILL_NAME = "SkillForSkill";
const REPO_ROOT = path.resolve(__dirname, "..");
const HOME_DIR = process.env.USERPROFILE || os.homedir();
const CODEX_CONFIG_PATH = path.join(HOME_DIR, ".codex", "config.toml");
const CLAUDE_MEMORY_PATH = path.join(HOME_DIR, ".claude", "CLAUDE.md");
const CODEX_CONFIG_HELPER = path.join(REPO_ROOT, "scripts", "update-codex-config.js");
const CLAUDE_MEMORY_HELPER = path.join(REPO_ROOT, "scripts", "update-claude-memory.js");

function usage() {
  console.error(`Usage: uninstall-windows.cmd [--target codex|claude]

Targets:
  codex   Uninstall SkillForSkill from Codex (default)
  claude  Uninstall SkillForSkill from Claude Code`);
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

function removeSkill(userSkillDir) {
  if (fs.existsSync(userSkillDir)) {
    fs.rmSync(userSkillDir, { recursive: true, force: true });
    console.log(`Uninstalled ${SKILL_NAME} from ${userSkillDir}`);
  } else {
    console.log(`${SKILL_NAME} skill directory is already uninstalled.`);
  }
}

function runHelper(helperPath, action, targetPath, ...extraArgs) {
  const result = spawnSync(process.execPath, [helperPath, action, targetPath, ...extraArgs], {
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

  requireFile(
    target === "codex" ? CODEX_CONFIG_HELPER : CLAUDE_MEMORY_HELPER,
    target === "codex" ? "config helper" : "Claude memory helper",
  );

  if (target === "codex") {
    removeSkill(path.join(HOME_DIR, ".codex", "skills", SKILL_NAME));
    runHelper(CODEX_CONFIG_HELPER, "uninstall", CODEX_CONFIG_PATH, REPO_ROOT);

    console.log(`Codex config: ${CODEX_CONFIG_PATH}`);
    console.log("Restart Codex and open a new thread to reload skill metadata and global instructions.");
    return;
  }

  removeSkill(path.join(HOME_DIR, ".claude", "skills", SKILL_NAME));
  runHelper(CLAUDE_MEMORY_HELPER, "uninstall", CLAUDE_MEMORY_PATH);

  console.log(`Claude memory: ${CLAUDE_MEMORY_PATH}`);
  console.log("Claude memory file is left in place even if it is empty.");
  console.log("Restart Claude Code and open a new session to reload skill metadata and global instructions.");
}

main();
