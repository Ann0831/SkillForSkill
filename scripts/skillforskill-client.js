#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const { READ_COMMANDS, WRITE_COMMANDS } = require("../main");
const serverContract = require("../server-contract.json");

const PROJECT_DIR = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(PROJECT_DIR, "server.js");
const REQUEST_TIMEOUT_MS = 800;
const STARTUP_TIMEOUT_MS = 8000;
const STARTUP_POLL_MS = 250;

function candidateUrl(port, endpoint) {
  if (!serverContract.ports.includes(port)) {
    throw new Error(`Port is not in the SkillForSkill server contract: ${port}`);
  }

  if (!["/api/health", "/api/read", "/api/write"].includes(endpoint)) {
    throw new Error(`Endpoint is not allowed by the SkillForSkill client: ${endpoint}`);
  }

  return `http://${serverContract.host}:${port}${endpoint}`;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function fail(message, extra = {}) {
  printJson({
    ok: false,
    error: message,
    ...extra,
  });
  process.exitCode = 1;
}

function parseArgsJson(value) {
  if (value === undefined) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("args-json must decode to a JSON object.");
    }

    return parsed;
  } catch (error) {
    throw new Error(error.message || "args-json must be valid JSON.");
  }
}

function validateCommand(kind, command) {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("command must be a non-empty string.");
  }

  const isReadCommand = READ_COMMANDS.has(command);
  const isWriteCommand = WRITE_COMMANDS.has(command);

  if (!isReadCommand && !isWriteCommand) {
    throw new Error(`Unknown command: ${command}`);
  }

  if (kind === "read" && !isReadCommand) {
    throw new Error(`${command} is a write command. Use "write", not "read".`);
  }

  if (kind === "write" && !isWriteCommand) {
    throw new Error(`${command} is a read command. Use "read", not "write".`);
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Invalid JSON response from ${url}.`);
    }

    return {
      data,
      status: response.status,
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkPort(port) {
  const url = candidateUrl(port, "/api/health");

  try {
    const result = await fetchJson(url);
    const isValid =
      result.status === 200 &&
      result.data &&
      result.data.ok === true &&
      result.data.service === serverContract.service;

    if (!isValid) {
      return null;
    }

    return {
      health: result.data,
      host: serverContract.host,
      ok: true,
      port,
      url: `http://${serverContract.host}:${port}`,
    };
  } catch (error) {
    return null;
  }
}

async function findServer() {
  for (const port of serverContract.ports) {
    const server = await checkPort(port);

    if (server) {
      return server;
    }
  }

  return null;
}

function startServerProcess() {
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: PROJECT_DIR,
    detached: true,
    stdio: "ignore",
  });

  child.unref();
  return child.pid;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    const server = await findServer();

    if (server) {
      return server;
    }

    await sleep(STARTUP_POLL_MS);
  }

  return null;
}

async function ensureServer() {
  const existingServer = await findServer();

  if (existingServer) {
    return {
      ...existingServer,
      started: false,
    };
  }

  const pid = startServerProcess();
  const startedServer = await waitForServer();

  if (!startedServer) {
    throw new Error(
      `SkillForSkill server did not become healthy on contract ports: ${serverContract.ports.join(
        ", ",
      )}.`,
    );
  }

  return {
    ...startedServer,
    pid,
    started: true,
  };
}

async function callRead(command, args) {
  validateCommand("read", command);
  const server = await ensureServer();
  const params = new URLSearchParams({
    command,
    args: JSON.stringify(args),
  });
  const result = await fetchJson(
    `${candidateUrl(server.port, "/api/read")}?${params.toString()}`,
  );

  if (result.status !== 200 || result.data.ok !== true) {
    throw new Error(result.data.error || `Read command failed: ${command}`);
  }

  return {
    ...result.data,
    serverUrl: server.url,
  };
}

async function callWrite(command, args) {
  validateCommand("write", command);
  const server = await ensureServer();
  const result = await fetchJson(candidateUrl(server.port, "/api/write"), {
    body: JSON.stringify({
      args,
      command,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (result.status !== 200 || result.data.ok !== true) {
    throw new Error(result.data.error || `Write command failed: ${command}`);
  }

  return {
    ...result.data,
    serverUrl: server.url,
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/skillforskill-client.js ensure-server",
    "  node scripts/skillforskill-client.js health",
    "  node scripts/skillforskill-client.js read <command> [args-json]",
    "  node scripts/skillforskill-client.js write <command> [args-json]",
  ].join("\n");
}

async function main() {
  const [action, command, argsJson] = process.argv.slice(2);

  if (action === "ensure-server") {
    printJson(await ensureServer());
    return;
  }

  if (action === "health") {
    const server = await findServer();

    if (!server) {
      throw new Error(
        `No healthy SkillForSkill server found on contract ports: ${serverContract.ports.join(
          ", ",
        )}.`,
      );
    }

    printJson(server);
    return;
  }

  if (action === "read") {
    printJson(await callRead(command, parseArgsJson(argsJson)));
    return;
  }

  if (action === "write") {
    printJson(await callWrite(command, parseArgsJson(argsJson)));
    return;
  }

  throw new Error(usage());
}

main().catch((error) => {
  fail(error.message || "Unexpected SkillForSkill client error.");
});
