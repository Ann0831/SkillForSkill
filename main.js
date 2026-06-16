const { runCommand } = require("./src/commands");

function parseCommandArgs(args) {
  if (!Array.isArray(args)) {
    return args || {};
  }

  return args.reduce((parsedArgs, arg, index) => {
    if (!arg.startsWith("--")) {
      return parsedArgs;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const nextArg = args[index + 1];

    parsedArgs[rawKey] =
      inlineValue !== undefined || nextArg === undefined || nextArg.startsWith("--")
        ? inlineValue ?? true
        : nextArg;

    return parsedArgs;
  }, {});
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function execute({ command, args }) {
  return runCommand({
    command,
    args: parseCommandArgs(args),
  });
}

function parseCliArgs(argv) {
  const normalizedArgv = argv[0] === "---" ? argv.slice(1) : argv;
  const [command, ...args] = normalizedArgv;

  return {
    command,
    args,
  };
}

if (require.main === module) {
  const input = parseCliArgs(process.argv.slice(2));

  execute(input)
    .then(printJson)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { execute };
