const { runCommand } = require("./src/commands");

const READ_COMMANDS = new Set([
  "list-works",
  "list-work-candidates",
  "list-potential-skills",
  "get-work-skill-reference",
  "get-work",
  "get-task",
  "get-potential-skill",
]);

const WRITE_COMMANDS = new Set([
  "add-work",
  "add-task",
  "add-potential-skill",
  "discard-work",
]);

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readRequestData(req) {
  const data =
    req.method === "GET" && req.query && req.query.command
      ? req.query
      : req.body || {};

  if (typeof data !== "object" || Array.isArray(data)) {
    throw createError("Request body must be a JSON object.");
  }

  return {
    command: data.command,
    args: parseRequestArgs(data.args),
  };
}

function parseRequestArgs(args) {
  if (args === undefined) {
    return {};
  }

  if (typeof args !== "string") {
    return args;
  }

  try {
    return JSON.parse(args);
  } catch (error) {
    throw createError("args must be valid JSON.");
  }
}

function validateArgs(args) {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw createError("args must be a JSON object.");
  }

  return args;
}

function validateCommandForEndpoint(command, allowedCommands, endpointName) {
  if (typeof command !== "string" || command.trim() === "") {
    throw createError("command must be a non-empty string.");
  }

  if (!READ_COMMANDS.has(command) && !WRITE_COMMANDS.has(command)) {
    throw createError(`Unknown command: ${command}`);
  }

  if (!allowedCommands.has(command)) {
    throw createError(`${command} is not allowed on ${endpointName}.`);
  }

  return command;
}

async function handleCommand(req, res, allowedCommands, endpointName) {
  const { command, args } = readRequestData(req);
  const safeCommand = validateCommandForEndpoint(
    command,
    allowedCommands,
    endpointName,
  );
  const safeArgs = validateArgs(args);
  const result = await runCommand({ command: safeCommand, args: safeArgs });

  res.json({
    ok: true,
    result,
  });
}

async function handleReadCommand(req, res, next) {
  try {
    await handleCommand(req, res, READ_COMMANDS, "GET /api/read");
  } catch (error) {
    next(error);
  }
}

async function handleWriteCommand(req, res, next) {
  try {
    await handleCommand(req, res, WRITE_COMMANDS, "POST /api/write");
  } catch (error) {
    next(error);
  }
}

function handleCommandError(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(error.statusCode || 400).json({
    ok: false,
    error: error.message || "Unexpected error.",
  });
}

module.exports = {
  handleReadCommand,
  handleWriteCommand,
  handleCommandError,
  READ_COMMANDS,
  WRITE_COMMANDS,
};
