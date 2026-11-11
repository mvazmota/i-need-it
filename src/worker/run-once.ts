import "./load-env";
import { runChecks } from "./run-checks";

const forceAll = process.argv.includes("--all");

runChecks({ dueOnly: !forceAll, concurrency: 2 })
  .then((summary) => {
    if (summary.total > 0 && summary.failed === summary.total) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(`[check] fatal: ${(error as Error).message}`);
    process.exitCode = 1;
  });
