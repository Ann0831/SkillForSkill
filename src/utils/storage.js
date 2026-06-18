const fs = require("fs");
const path = require("path");

const { defaultDataDir, workTaskLimit } = require("../../config");

const defaultWorkState = {
  hasPotentialSkill: false,
  isSkillCandidate: null,
  potentialSkillName: null,
};

function assertSafeName(name, label) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }

  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`${label} must not include path separators.`);
  }

  return name.trim();
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function ensureExtension(fileName, extension) {
  return fileName.endsWith(extension) ? fileName : `${fileName}${extension}`;
}

function writeJsonFile(filePath, content, flag = "wx") {
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, {
    encoding: "utf8",
    flag,
  });
}

function writeTextFile(filePath, content, flag = "wx") {
  fs.writeFileSync(filePath, content, {
    encoding: "utf8",
    flag,
  });
}

function ensureWorkState(workDir) {
  const statePath = path.join(workDir, "state.json");

  if (!fs.existsSync(statePath)) {
    writeJsonFile(statePath, defaultWorkState);
    return statePath;
  }

  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const nextState = {
    ...defaultWorkState,
    ...state,
  };

  if (JSON.stringify(state) !== JSON.stringify(nextState)) {
    writeJsonFile(statePath, nextState, "w");
  }

  return statePath;
}

function ensureWorkDescription(workDir, description = "") {
  const descriptionPath = path.join(workDir, "description.md");

  if (!fs.existsSync(descriptionPath)) {
    writeTextFile(descriptionPath, description);
  }

  return descriptionPath;
}

function readWorkState(workDir) {
  const statePath = path.join(workDir, "state.json");

  if (!fs.existsSync(statePath)) {
    return defaultWorkState;
  }

  return {
    ...defaultWorkState,
    ...JSON.parse(fs.readFileSync(statePath, "utf8")),
  };
}

function updateWorkState(workDir, nextStatePatch) {
  const statePath = ensureWorkState(workDir);
  const state = readWorkState(workDir);
  const nextState = {
    ...state,
    ...nextStatePatch,
  };

  writeJsonFile(statePath, nextState, "w");

  return statePath;
}

function readWorkDescription(workDir) {
  const descriptionPath = path.join(workDir, "description.md");

  if (!fs.existsSync(descriptionPath)) {
    return "";
  }

  return fs.readFileSync(descriptionPath, "utf8");
}

function listTaskFiles(workDir) {
  return fs
    .readdirSync(workDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "description.md",
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function assertWorkSource(source = "work") {
  if (source !== "work" && source !== "discarded_work") {
    throw new Error("source must be work or discarded_work.");
  }

  return source;
}

function getWorkDir({ workName, source = "work", rootDir = defaultDataDir }) {
  const safeWorkName = assertSafeName(workName, "workName");
  const safeSource = assertWorkSource(source);
  const workDir = path.join(rootDir, safeSource, safeWorkName);

  if (!fs.existsSync(workDir)) {
    throw new Error(`Work does not exist: ${workDir}`);
  }

  return {
    isDiscarded: safeSource === "discarded_work",
    source: safeSource,
    workDir,
    workName: safeWorkName,
  };
}

function addWork({ workName, description = "", rootDir = defaultDataDir }) {
  const safeWorkName = assertSafeName(workName, "workName");
  const workDir = path.join(rootDir, "work", safeWorkName);

  fs.mkdirSync(workDir, { recursive: true });
  const statePath = ensureWorkState(workDir);
  const descriptionPath = ensureWorkDescription(workDir, description);

  return {
    descriptionPath,
    statePath,
    workDir,
  };
}

function listWorkEntries(workRootDir, { isDiscarded = false } = {}) {
  if (!fs.existsSync(workRootDir)) {
    return [];
  }

  return fs
    .readdirSync(workRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const workName = entry.name;
      const workDir = path.join(workRootDir, workName);
      const description = readWorkDescription(workDir);
      const state = readWorkState(workDir);
      const taskFiles = listTaskFiles(workDir);

      return {
        description,
        hasPotentialSkill: Boolean(state.hasPotentialSkill),
        isDiscarded,
        isFutureWorkUnneeded: Boolean(state.isFutureWorkUnneeded),
        isSkillCandidate: state.isSkillCandidate,
        potentialSkillName: state.potentialSkillName || null,
        taskCount: taskFiles.length,
        taskFiles,
        workDir,
        workName,
      };
    });
}

function listWorks({
  rootDir = defaultDataDir,
  includeFutureUnneededDiscardedWork = false,
} = {}) {
  const workRootDir = path.join(rootDir, "work");
  const activeWorks = listWorkEntries(workRootDir);

  if (!includeFutureUnneededDiscardedWork) {
    return activeWorks.sort((a, b) => a.workName.localeCompare(b.workName));
  }

  const discardedWorkRootDir = path.join(rootDir, "discarded_work");
  const discardedWorks = listWorkEntries(discardedWorkRootDir, {
    isDiscarded: true,
  }).filter((work) => work.isFutureWorkUnneeded);

  return [...activeWorks, ...discardedWorks]
    .sort((a, b) => a.workName.localeCompare(b.workName));
}

function addTaskToWork({
  workName,
  taskName,
  content = "",
  rootDir = defaultDataDir,
}) {
  const safeTaskName = assertSafeName(taskName, "taskName");
  const { statePath, workDir } = addWork({ workName, rootDir });
  const taskPath = path.join(workDir, ensureExtension(safeTaskName, ".md"));

  fs.writeFileSync(taskPath, content, { encoding: "utf8", flag: "wx" });

  return {
    statePath,
    workDir,
    taskPath,
  };
}

function getWorksExceedingTaskLimit({
  rootDir = defaultDataDir,
  taskLimit = workTaskLimit,
} = {}) {
  const workRootDir = path.join(rootDir, "work");

  if (!fs.existsSync(workRootDir)) {
    return [];
  }

  return fs
    .readdirSync(workRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const workName = entry.name;
      const workDir = path.join(workRootDir, workName);
      const description = readWorkDescription(workDir);
      const state = readWorkState(workDir);
      const taskFiles = listTaskFiles(workDir);
      const stats = fs.statSync(workDir);

      return {
        createdAt: stats.birthtime.toISOString(),
        createdAtMs: stats.birthtimeMs,
        description,
        hasPotentialSkill: Boolean(state.hasPotentialSkill),
        isSkillCandidate: state.isSkillCandidate,
        taskCount: taskFiles.length,
        taskFiles,
        taskLimit,
        workDir,
        workName,
      };
    })
    .filter(
      (work) => !work.hasPotentialSkill && work.taskCount > work.taskLimit,
    )
    .sort(
      (a, b) =>
        a.createdAtMs - b.createdAtMs || a.workName.localeCompare(b.workName),
    );
}

function getWorkSkillReference({ workName, rootDir = defaultDataDir }) {
  const safeWorkName = assertSafeName(workName, "workName");
  const workDir = path.join(rootDir, "work", safeWorkName);

  if (!fs.existsSync(workDir)) {
    throw new Error(`Work does not exist: ${workDir}`);
  }

  const description = readWorkDescription(workDir);
  const taskFiles = listTaskFiles(workDir);
  const taskSections = taskFiles.map((taskFile) => {
    const taskPath = path.join(workDir, taskFile);
    const taskContent = fs.readFileSync(taskPath, "utf8");

    return `### ${taskFile}\n\n${taskContent}`;
  });
  const referenceText = [
    `# Work: ${safeWorkName}`,
    "## Description",
    description,
    "## Tasks",
    ...taskSections,
  ].join("\n\n");

  return {
    description,
    referenceText,
    taskFiles,
    workDir,
    workName: safeWorkName,
  };
}

function getWork({ workName, source = "work", rootDir = defaultDataDir }) {
  const work = getWorkDir({ workName, source, rootDir });
  const description = readWorkDescription(work.workDir);
  const state = readWorkState(work.workDir);
  const taskFiles = listTaskFiles(work.workDir);

  return {
    ...work,
    description,
    hasPotentialSkill: Boolean(state.hasPotentialSkill),
    isFutureWorkUnneeded: Boolean(state.isFutureWorkUnneeded),
    isSkillCandidate: state.isSkillCandidate,
    potentialSkillName: state.potentialSkillName || null,
    state,
    taskCount: taskFiles.length,
    taskFiles,
  };
}

function getTask({
  workName,
  taskName,
  source = "work",
  rootDir = defaultDataDir,
}) {
  const work = getWorkDir({ workName, source, rootDir });
  const safeTaskName = ensureExtension(assertSafeName(taskName, "taskName"), ".md");

  if (safeTaskName === "description.md") {
    throw new Error("taskName must refer to a task Markdown file.");
  }

  const taskPath = path.join(work.workDir, safeTaskName);

  if (!fs.existsSync(taskPath)) {
    throw new Error(`Task does not exist: ${taskPath}`);
  }

  return {
    ...work,
    content: fs.readFileSync(taskPath, "utf8"),
    taskName: safeTaskName,
    taskPath,
  };
}

function discardWork({
  workName,
  isFutureWorkUnneeded = false,
  rootDir = defaultDataDir,
}) {
  const safeWorkName = assertSafeName(workName, "workName");
  const safeIsFutureWorkUnneeded = assertBoolean(
    isFutureWorkUnneeded,
    "isFutureWorkUnneeded",
  );
  const workDir = path.join(rootDir, "work", safeWorkName);
  const discardedWorkRootDir = path.join(rootDir, "discarded_work");
  const discardedWorkDir = path.join(discardedWorkRootDir, safeWorkName);

  if (!fs.existsSync(workDir)) {
    throw new Error(`Work does not exist: ${workDir}`);
  }

  if (fs.existsSync(discardedWorkDir)) {
    throw new Error(`Discarded work already exists: ${discardedWorkDir}`);
  }

  fs.mkdirSync(discardedWorkRootDir, { recursive: true });
  fs.renameSync(workDir, discardedWorkDir);

  const statePath = path.join(discardedWorkDir, "state.json");
  const state = readWorkState(discardedWorkDir);

  writeJsonFile(
    statePath,
    {
      ...state,
      isFutureWorkUnneeded: safeIsFutureWorkUnneeded,
    },
    "w",
  );

  return {
    discardedWorkDir,
    statePath,
    workDir,
  };
}

function addWorkTask(options) {
  return addTaskToWork(options);
}

function listPotentialSkillPaths({ rootDir = defaultDataDir } = {}) {
  const potentialSkillDir = path.join(rootDir, "potential_skill");

  if (!fs.existsSync(potentialSkillDir)) {
    return [];
  }

  return fs
    .readdirSync(potentialSkillDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => path.join(potentialSkillDir, fileName));
}

function addPotentialSkill({
  workName,
  skillName,
  content = "",
  rootDir = defaultDataDir,
}) {
  const safeWorkName = assertSafeName(workName, "workName");
  const safeSkillName = assertSafeName(skillName, "skillName");
  const workDir = path.join(rootDir, "work", safeWorkName);
  const potentialSkillDir = path.join(rootDir, "potential_skill");
  const skillPath = path.join(
    potentialSkillDir,
    ensureExtension(safeSkillName, ".md"),
  );

  if (!fs.existsSync(workDir)) {
    throw new Error(`Work does not exist: ${workDir}`);
  }

  fs.mkdirSync(potentialSkillDir, { recursive: true });
  writeTextFile(skillPath, content);
  const statePath = updateWorkState(workDir, {
    hasPotentialSkill: true,
    potentialSkillName: ensureExtension(safeSkillName, ".md"),
  });

  return {
    skillPath,
    statePath,
    workDir,
  };
}

function getPotentialSkill({ skillName, rootDir = defaultDataDir }) {
  const safeSkillName = ensureExtension(assertSafeName(skillName, "skillName"), ".md");
  const skillPath = path.join(rootDir, "potential_skill", safeSkillName);

  if (!fs.existsSync(skillPath)) {
    throw new Error(`Potential skill does not exist: ${skillPath}`);
  }

  return {
    content: fs.readFileSync(skillPath, "utf8"),
    skillName: safeSkillName,
    skillPath,
  };
}

function discardSkill({ skillName, rootDir = defaultDataDir }) {
  const safeSkillName = assertSafeName(skillName, "skillName");
  const skillFileName = ensureExtension(safeSkillName, ".md");
  const potentialSkillPath = path.join(
    rootDir,
    "potential_skill",
    skillFileName,
  );
  const discardedSkillDir = path.join(rootDir, "discarded_skill");
  const discardedSkillPath = path.join(discardedSkillDir, skillFileName);

  if (!fs.existsSync(potentialSkillPath)) {
    throw new Error(`Potential skill does not exist: ${potentialSkillPath}`);
  }

  if (fs.existsSync(discardedSkillPath)) {
    throw new Error(`Discarded skill already exists: ${discardedSkillPath}`);
  }

  fs.mkdirSync(discardedSkillDir, { recursive: true });
  fs.renameSync(potentialSkillPath, discardedSkillPath);

  return {
    discardedSkillPath,
    skillPath: potentialSkillPath,
  };
}

module.exports = {
  addPotentialSkill,
  addWork,
  addTaskToWork,
  addWorkTask,
  discardSkill,
  discardWork,
  getPotentialSkill,
  getTask,
  getWork,
  getWorkSkillReference,
  getWorksExceedingTaskLimit,
  listPotentialSkillPaths,
  listWorks,
};
