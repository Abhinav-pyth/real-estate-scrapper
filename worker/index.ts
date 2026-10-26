// Indore Property Finder — background ingestion worker.
// Runs OUTSIDE the web app (Vercel serverless functions are too short-lived for sync jobs).
// Deploy on any Node host: Railway / Fly.io / Render / a small VM, or `npm run worker` locally.
//
// Responsibilities:
//  1. BullMQ scheduled repeats per connector scheduleCron (only connectors that are
//     enabled AND pass the collection-policy gate inside jobRunner.runSyncJob).
//  2. Staleness pass every hour (marks listings STALE/UNAVAILABLE per the state model;
//     never deletes silently).
//  3. Graceful shutdown (SIGTERM/SIGINT) and health log lines.
//
// Without Redis configured the worker degrades to a plain setInterval scheduler so the
// pipeline still runs on simple hosts.

import { prisma } from "../src/lib/db";
import { createAndRunSyncJob, markStaleListings } from "../src/lib/jobRunner";

const QUEUE_NAME = "ipf-sync";

async function tickScheduledConnectors() {
  const connectors = await prisma.sourceConnector.findMany({
    where: { enabled: true },
    orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
  });
  const now = Date.now();
  for (const c of connectors) {
    // naive cadence: re-run if more than interval old; cron parsing intentionally avoided
    const intervalMs = Math.max(60_000, Math.round((c.scheduleCron ? 6 : 12) * 3600_000 / 12));
    if (!c.lastSyncAt || now - c.lastSyncAt.getTime() >= intervalMs) {
      console.log(`[worker] dispatching sync for ${c.key}`);
      try {
        const r = await createAndRunSyncJob(c.id, "SYSTEM");
        console.log(`[worker] ${c.key}: ${r.status} new=${r.newCount} updated=${r.updatedCount} errors=${r.errorCount ?? 0}`);
      } catch (e) {
        console.error(`[worker] ${c.key} dispatch failed:`, (e as Error).message);
      }
    }
  }
}

let bullmqStarted = false;
async function tryBullMQ() {
  if (!process.env.REDIS_URL) return false;
  try {
    const { Queue, Worker } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const queue = new Queue(QUEUE_NAME, { connection });
    new Worker(
      QUEUE_NAME,
      async (job) => {
        const { connectorId, triggeredBy } = job.data as { connectorId: string; triggeredBy: string };
        return createAndRunSyncJob(connectorId, triggeredBy === "cron" ? "SYSTEM" : "ADMIN:worker");
      },
      { connection, concurrency: 1 }
    );
    // schedule repeats from DB
    const connectors = await prisma.sourceConnector.findMany({ where: { enabled: true } });
    for (const c of connectors) {
      await queue.add(
        "sync",
        { connectorId: c.id, triggeredBy: "cron" },
        { repeat: c.scheduleCron ? { pattern: c.scheduleCron } : undefined, jobId: `sync-${c.key}`, attempts: 2, backoff: { type: "exponential", delay: 30_000 } }
      );
    }
    bullmqStarted = true;
    console.log(`[worker] BullMQ active against Redis (${QUEUE_NAME}, ${connectors.length} scheduled)`);
    return true;
  } catch (e) {
    console.warn("[worker] BullMQ unavailable, falling back to interval scheduler:", (e as Error).message);
    return false;
  }
}

async function main() {
  console.log("[worker] Indore Property Finder worker starting…");
  const useQueue = await tryBullMQ();
  if (!useQueue) {
    // fallback loop: check every 5 minutes
    await tickScheduledConnectors().catch((e) => console.error("[worker] tick error:", e));
    setInterval(() => tickScheduledConnectors().catch((e) => console.error("[worker] tick error:", e)), 5 * 60_000);
  }
  // hourly staleness pass regardless of queue mode
  setInterval(() => markStaleListings().catch((e) => console.error("[worker] stale error:", e)), 3600_000);

  const shutdown = (sig: string) => {
    console.log(`[worker] ${sig} received — shutting down gracefully`);
    prisma
      .$disconnect()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  console.log(`[worker] running (queue=${bullmqStarted ? "bullmq" : "interval"})`);
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
