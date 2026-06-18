const express = require("express");
const path = require("path");

const { version } = require("./package.json");
const serverContract = require("./server-contract.json");
const {
  handleCommandError,
  handleReadCommand,
  handleWriteCommand,
} = require("./main");

let pid = null;

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, "public");

  app.use(express.json());
  app.use("/public", express.static(publicDir));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "SkillForSkill",
      mode: "rest",
      version,
    });
  });

  app.get("/api/read", handleReadCommand);
  app.post("/api/write", handleWriteCommand);

  app.get("/", (req, res) => {
    res.redirect("/user-space");
  });
  app.get(["/user-space", "/user-space/*"], (req, res) => {
    res.sendFile(path.join(publicDir, "user-space.html"));
  });
  app.get("/pid", (req, res) => {
    res.json({
      ok: true,
      pid,
    });
  });
  app.use(handleCommandError);

  return app;
}

function listenOnPort(app, host, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);

    server.once("listening", () => {
      resolve(server);
    });

    server.once("error", (error) => {
      reject(error);
    });
  });
}

async function startServer({
  host = serverContract.host,
  ports = serverContract.ports,
} = {}) {
  const app = createApp();
  const attemptedPorts = [];

  for (const port of ports) {
    attemptedPorts.push(port);

    try {
      const server = await listenOnPort(app, host, port);
      pid = process.pid;
      const address = server.address();
      const actualPort =
        address && typeof address === "object" ? address.port : port;

      console.log(
        `SkillForSkill REST server listening at http://${host}:${actualPort}`,
      );

      return server;
    } catch (error) {
      if (error.code !== "EADDRINUSE") {
        throw error;
      }

      console.warn(
        `SkillForSkill REST port ${port} is already in use; trying next fallback port.`,
      );
    }
  }

  throw new Error(
    `SkillForSkill REST server could not start. All contract ports are in use: ${attemptedPorts.join(
      ", ",
    )}.`,
  );
}

function logStartupError(error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

if (require.main === module) {
  startServer().catch(logStartupError);
}

module.exports = {
  createApp,
  startServer,
};
