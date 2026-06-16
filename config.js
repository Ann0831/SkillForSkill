const os = require("os");
const path = require("path");

const configJson = require("./config.json");

const config = {
  defaultDataDir: path.join(os.homedir(), ".SkillForSkillStorage"),
  ...configJson,
};

module.exports = config;
