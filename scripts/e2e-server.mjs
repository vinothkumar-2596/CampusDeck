import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server/local.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: "5174",
      DATABASE_PATH: ":memory:",
      ADMIN_EMAILS: "qa@campusdeck.test",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
