const fs = require("fs");
const path = require("path");

const { defaultDataDir } = require("../../config");

function getNodeId(rootDir, dirPath) {
  const relativePath = path.relative(rootDir, dirPath);

  return relativePath || ".";
}

function createDirectoryNode(rootDir, dirPath) {
  return {
    id: getNodeId(rootDir, dirPath),
    name: path.basename(dirPath),
    path: dirPath,
    edges: [],
  };
}

function collectDirectoryNodes(rootDir, dirPath, nodes) {
  const node = createDirectoryNode(rootDir, dirPath);

  nodes.push(node);

  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  node.edges = entries.map((entry) =>
    getNodeId(rootDir, path.join(dirPath, entry.name)),
  );

  entries.forEach((entry) => {
    collectDirectoryNodes(rootDir, path.join(dirPath, entry.name), nodes);
  });
}

function getSkillDetectorDirectoryTree(rootDir = defaultDataDir) {
  const nodes = [];

  collectDirectoryNodes(rootDir, rootDir, nodes);

  return { nodes };
}

module.exports = {
  getSkillDetectorDirectoryTree,
};
