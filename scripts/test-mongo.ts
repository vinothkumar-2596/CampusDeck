import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "tests/api.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, TEST_MONGODB: "1" },
  },
);
process.exit(result.status || (result.error ? 1 : 0));
