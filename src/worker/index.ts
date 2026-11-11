import "./load-env";
import cron from "node-cron";
import { runChecks } from "./run-checks";

const expression = process.env.CHECK_CRON?.trim() || "*/15 * * * *";

if (!cron.validate(expression)) {
  console.error(
    `[worker] invalid CHECK_CRON expression "${expression}". Use a standard 5-field cron expression.`,
  );
  process.exit(1);
}

let running = false;

async function tick(reason: string) {
  if (running) {
    console.log(`[worker] previous run still active, skipping ${reason} tick`);
    return;
  }

  running = true;
  const started = Date.now();
  try {
    console.log(`[worker] ${reason} tick`);
    await runChecks({ dueOnly: true, concurrency: 2 });
  } catch (error) {
    console.error(`[worker] tick failed: ${(error as Error).message}`);
  } finally {
    running = false;
    console.log(`[worker] tick finished in ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

const timezone = process.env.TZ;
const task = cron.schedule(expression, () => void tick("cron"), {
  timezone,
});

console.log(
  `[worker] started; schedule "${expression}"${timezone ? ` (${timezone})` : ""}; ntfy ${
    process.env.NTFY_TOPIC ? "enabled" : "disabled"
  }`,
);

if (process.env.CHECK_ON_START !== "false") {
  void tick("startup");
}

function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, stopping`);
  task.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
