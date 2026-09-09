import {
  cleanupUnreferencedPodcastAudio,
  DEFAULT_PODCAST_AUDIO_RETENTION_MS,
} from "../lib/podcast-persistence";

function usage() {
  console.log([
    "Usage: pnpm --filter @workspace/scripts cleanup:podcast-audio [--apply] [--retention-hours=N]",
    "",
    "Lists content-addressed podcast WAV objects and compares them with PostgreSQL references.",
    "Dry-run is the default. --apply deletes only exact, unreferenced objects older than the retention window.",
    `Default retention: ${DEFAULT_PODCAST_AUDIO_RETENTION_MS / (60 * 60 * 1000)} hours (7 days).`,
  ].join("\n"));
}

let dryRun = true;
let retentionMs = DEFAULT_PODCAST_AUDIO_RETENTION_MS;
for (const argument of process.argv.slice(2)) {
  if (argument === "--apply") {
    dryRun = false;
  } else if (argument === "--help" || argument === "-h") {
    usage();
    process.exit(0);
  } else if (argument.startsWith("--retention-hours=")) {
    const hours = Number(argument.slice("--retention-hours=".length));
    if (!Number.isFinite(hours) || hours < 0) throw new Error("--retention-hours must be a non-negative number");
    retentionMs = hours * 60 * 60 * 1000;
  } else {
    throw new Error(`Unsupported argument: ${argument}`);
  }
}

const report = await cleanupUnreferencedPodcastAudio({ dryRun, retentionMs });
console.log(JSON.stringify(report, null, 2));
if (report.failedObjects.length > 0) process.exitCode = 1;