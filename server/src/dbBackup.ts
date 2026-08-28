import path from "node:path";
import os from "node:os";
import { readFile, unlink } from "node:fs/promises";
import Database from "better-sqlite3";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger.js";

const BACKUP_PREFIX = "db-backups/";
const KEEP_COUNT = 14; // ~2 weeks of daily backups

function dbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) throw new Error("Database backups only support a file: DATABASE_URL");
  return url.slice("file:".length);
}

function s3Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function backupsConfigured(): boolean {
  return !!s3Client() && !!process.env.R2_BUCKET_NAME;
}

// SQLite's native online backup API (exposed here via better-sqlite3) is
// safe to run against a live, actively-written database — it copies page
// by page and retries pages that change mid-copy, so it can't capture a
// torn/corrupted mid-write state the way a raw file copy or a disk-level
// snapshot can. This is exactly what Render's own docs recommend instead
// of relying on their disk snapshots for database recovery.
async function createSnapshot(): Promise<string> {
  const source = new Database(dbFilePath(), { readonly: true });
  const tmpPath = path.join(os.tmpdir(), `spark-backup-${Date.now()}.db`);
  try {
    await source.backup(tmpPath);
  } finally {
    source.close();
  }
  return tmpPath;
}

async function pruneOldBackups(client: S3Client, bucket: string): Promise<number> {
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: BACKUP_PREFIX }));
  const keys = (listed.Contents ?? [])
    .map((o) => o.Key)
    .filter((k): k is string => !!k)
    .sort((a, b) => (a < b ? 1 : -1)); // filenames are ISO-timestamp-sortable — newest first
  const toDelete = keys.slice(KEEP_COUNT);
  for (const key of toDelete) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  return toDelete.length;
}

export type BackupResult =
  | { status: "uploaded"; key: string; pruned: number }
  | { status: "skipped"; reason: string };

export async function runDatabaseBackup(): Promise<BackupResult> {
  const client = s3Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) return { status: "skipped", reason: "R2 credentials are not configured" };

  const tmpPath = await createSnapshot();
  try {
    const body = await readFile(tmpPath);
    const key = `${BACKUP_PREFIX}spark-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
    const pruned = await pruneOldBackups(client, bucket);
    return { status: "uploaded", key, pruned };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

function msUntilNextUtcHour(hour: number): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

// Runs once daily at a fixed UTC hour. Only active when R2 credentials are
// present, so local dev and tests (which never set them) silently skip
// instead of erroring — this is called unconditionally at server startup.
export function scheduleBackups(): void {
  if (process.env.NODE_ENV === "test") return;
  if (!backupsConfigured()) {
    logger.info("[backup] R2 credentials not set — scheduled database backups are disabled.");
    return;
  }

  const runAndReschedule = async () => {
    try {
      const result = await runDatabaseBackup();
      if (result.status === "uploaded") {
        logger.info(`[backup] Database backup uploaded: ${result.key} (pruned ${result.pruned} old backup${result.pruned === 1 ? "" : "s"})`);
      } else {
        logger.info(`[backup] Skipped: ${result.reason}`);
      }
    } catch (err) {
      logger.error({ err }, "[backup] Scheduled database backup failed");
    }
    setTimeout(runAndReschedule, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = msUntilNextUtcHour(8);
  setTimeout(runAndReschedule, msUntilNextRun);
  logger.info(`[backup] Scheduled daily database backups (next run in ${Math.round(msUntilNextRun / 60000)} min).`);
}
