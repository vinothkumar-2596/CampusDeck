import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server/local.ts", "--production"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: "5181",
      DATABASE_PATH: ":memory:",
      MONGODB_URI: "",
      ADMIN_EMAILS: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
