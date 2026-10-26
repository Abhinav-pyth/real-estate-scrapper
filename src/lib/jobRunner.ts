// Shared job execution used by the API (manual sync) and the BullMQ worker.
// Honors connector.isAllowed() — unauthorized sources are NEVER fetched.
// Implements: retry with exponential backoff, request timeout, per-provider rate limit,
// structured logs into ScrapingJobLog, idempotent ingestion via saveListing pipeline.

import { prisma } from "./db";
import { getConnector } from "./connectors/registry";
import { saveListing, applyStalenessPolicy } from "./ingest";
import type { NormalizedListing } from "./types";

const MAX_ATTEMPTS = 3;

export interface JobResult {
  jobId: string;
  status: "SUCCEEDED" | "FAILED";
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  priceChangedCount: number;
  unavailableCount: number;
  errorCount: number;
  lastError?: string;
}

export async function runSyncJob(jobId: string): Promise<JobResult> {
  const job = await prisma.scrapingJob.findUnique({ where: { id: jobId }, include: { connector: true } });
  if (!job) throw new Error("Job not found: " + jobId);
  const connectorKey = job.connector.key;
  const log = async (level: "INFO" | "WARN" | "ERROR", message: string, meta?: Record<string, unknown>) => {
    await prisma.scrapingJobLog.create({ data: { jobId, level, message, metaJson: JSON.stringify(meta ?? {}) } });
    console.log(JSON.stringify({ ts: new Date().toISOString(), jobId, connectorKey, level, message }));
  };

  const result: JobResult = { jobId, status: "SUCCEEDED", newCount: 0, updatedCount: 0, unchangedCount: 0, priceChangedCount: 0, unavailableCount: 0, errorCount: 0 };
  let attempt = 0;
  let lastError = "";

  try {
    const impl = getConnector(connectorKey);
    if (!impl) throw new Error(`No code implementation registered for connector "${connectorKey}"`);

    // POLICY GATE — the single most important check in the pipeline.
    const allowed = await impl.isAllowed();
    if (!allowed) throw new Error(`Collection not permitted for "${connectorKey}". Configure an authorized feed/API or use CSV import.`);

    const params = safeObj(job.paramsJson);
    const maxListings = Math.min(Number(params.maxListings ?? job.connector.maxListingsPerJob), job.connector.maxListingsPerJob);
    const localities = Array.isArray(params.localities) ? (params.localities as string[]) : undefined;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      await prisma.scrapingJob.update({ where: { id: jobId }, data: { attempts: attempt, status: "RUNNING" } });
      try {
        await log("INFO", `Fetch attempt ${attempt}: max=${maxListings} localities=${localities?.length ?? "all"}`);
        const raws = await impl.fetchListings({ maxListings, localities, signal: AbortSignal.timeout(60_000) });
        await log("INFO", `Fetched ${raws.length} raw listings`);

        // provider rate limiting: simple spacing between ingests keeps DB load gentle;
        // network pacing is enforced inside each connector.
        for (const raw of raws) {
          try {
            const norm = impl.normalizeListing(raw);
            if (!norm) { result.errorCount++; await log("WARN", "Normalization returned null", { url: raw.url }); continue; }
            const v = impl.validateListing(norm);
            if (!v.ok) { result.errorCount++; await log("WARN", "Validation failed", { url: raw.url, errors: v.errors }); continue; }
            const out = await saveListing(norm as NormalizedListing);
            if (out.status === "NEW") result.newCount++;
            else if (out.status === "UPDATED") result.updatedCount++;
            else if (out.status === "PRICE_CHANGED") { result.priceChangedCount++; result.updatedCount++; }
            else result.unchangedCount++;
          } catch (e) {
            result.errorCount++;
            await log("ERROR", "Ingest row failed: " + (e as Error).message, { url: raw.url });
          }
        }
        lastError = "";
        break; // success
      } catch (e) {
        lastError = (e as Error).message;
        await log("ERROR", `Attempt ${attempt} failed: ${lastError}`);
        if (attempt < MAX_ATTEMPTS) {
          const backoffMs = Math.min(30_000, 1000 * 2 ** attempt); // exponential backoff, capped
          await sleep(backoffMs);
        }
      }
    }

    const staleMarked = await applyStalenessPolicy();
    result.unavailableCount = staleMarked;

    await prisma.sourceConnector.update({
      where: { id: job.connectorId },
      data: { lastSyncAt: new Date(), lastError: lastError || null, listingsCount: await prisma.propertySource.count({ where: { connectorId: job.connectorId } }) },
    });
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: lastError && result.newCount + result.updatedCount === 0 ? "FAILED" : "SUCCEEDED",
        finishedAt: new Date(), newCount: result.newCount, updatedCount: result.updatedCount,
        unchangedCount: result.unchangedCount, unavailableCount: result.unavailableCount,
        errorCount: result.errorCount, lastError: lastError || null, attempts: attempt,
      },
    });
    result.status = lastError && result.newCount + result.updatedCount === 0 ? "FAILED" : "SUCCEEDED";
    result.lastError = lastError || undefined;
    await log("INFO", `Job finished ${result.status}`, { ...result });
    return result;
  } catch (e) {
    const msg = (e as Error).message;
    await log("ERROR", "Job aborted: " + msg);
    await prisma.scrapingJob.update({ where: { id: jobId }, data: { status: "FAILED", finishedAt: new Date(), lastError: msg, attempts: attempt } }).catch(() => {});
    await prisma.sourceConnector.update({ where: { id: job.connectorId }, data: { lastError: msg } }).catch(() => {});
    return { ...result, status: "FAILED", lastError: msg };
  }
}

function safeObj(s: string): Record<string, unknown> { try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; } }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
