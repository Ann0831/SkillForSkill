const {
  addPotentialSkill,
  addTaskToWork,
  addWork,
  discardWork,
  getPotentialSkill,
  getTask,
  getWork,
  getWorkSkillReference,
  getWorksExceedingTaskLimit,
  listPotentialSkillPaths,
  listWorks,
} = require("../utils/storage");

function parseJsonOption(value, optionName) {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${optionName} must be valid JSON.`);
  }
}

function parseBooleanOption(value, optionName) {
  if (value === undefined) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${optionName} must be true or false.`);
}

function parseNumberOption(value, optionName) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${optionName} must be a number.`);
  }

  return parsedValue;
}

async function runCommand({ command, args = {} }) {
  switch (command) {
    case "list-works":
      return listWorks({
        ...args,
        includeFutureUnneededDiscardedWork: parseBooleanOption(
          args.includeFutureUnneededDiscardedWork,
          "includeFutureUnneededDiscardedWork",
        ),
      });
    case "list-work-candidates":
      return getWorksExceedingTaskLimit({
        ...args,
        taskLimit: parseNumberOption(args.taskLimit, "taskLimit"),
      });
    case "list-potential-skills":
      return listPotentialSkillPaths(args);
    case "get-work-skill-reference":
      return getWorkSkillReference(args);
    case "get-work":
      return getWork(args);
    case "get-task":
      return getTask(args);
    case "get-potential-skill":
      return getPotentialSkill(args);
    case "add-work":
      return addWork(args);
    case "add-task":
      return addTaskToWork(args);
    case "add-potential-skill":
      return addPotentialSkill(args);
    case "discard-work":
      return discardWork({
        ...args,
        isFutureWorkUnneeded: parseBooleanOption(
          args.isFutureWorkUnneeded,
          "isFutureWorkUnneeded",
        ),
      });
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

module.exports = {
  runCommand,
};
