// Manual disaster-recovery tool — NOT run by the server itself. Run this
// directly (via `tsx scripts/restore-backup.ts <command>`) in whatever
// environment holds the live database (e.g. a Render shell session)
// when an actual restore is needed.
//
// Usage:
//   tsx scripts/restore-backup.ts list
//   tsx scripts/restore-backup.ts restore <key> --confirm
//
// `list` shows available backups, newest first. `restore` downloads the
// given key, moves the CURRENT live database aside (never deletes it
// outright) to <path>.pre-restore-<timestamp>, writes the downloaded
// backup into place, and tells you to restart the server process — it
// does not restart anything itself, since that's environment-specific.
import path from "node:path";
import { rename, writeFile } from "node:fs/promises";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const BACKUP_PREFIX = "db-backups/";

function dbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) throw new Error("DATABASE_URL must be a file: URL for this script to work.");
  return url.slice("file:".length);
}

function s3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must all be set.");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucket(): string {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error("R2_BUCKET_NAME must be set.");
  return b;
}

async function listBackups() {
  const client = s3Client();
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: BACKUP_PREFIX }));
  const objects = (listed.Contents ?? [])
    .filter((o) => o.Key)
    .sort((a, b) => (a.Key! < b.Key! ? 1 : -1));
  if (objects.length === 0) {
    console.log("No backups found.");
    return;
  }
  console.log(`${objects.length} backup(s), newest first:\n`);
  for (const o of objects) {
    const sizeMb = o.Size ? (o.Size / (1024 * 1024)).toFixed(2) : "?";
    console.log(`  ${o.Key}  (${sizeMb} MB, last modified ${o.LastModified?.toISOString() ?? "?"})`);
  }
}

async function restoreBackup(key: string, confirmed: boolean) {
  if (!confirmed) {
    console.error("Refusing to restore without --confirm. This overwrites the live database file.");
    console.error(`Re-run as: tsx scripts/restore-backup.ts restore "${key}" --confirm`);
    process.exit(1);
  }

  const client = s3Client();
  console.log(`Downloading ${key}...`);
  const obj = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const body = obj.Body;
  if (!body) throw new Error("Backup object had no body.");
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer>) chunks.push(chunk);
  const downloaded = Buffer.concat(chunks);

  const livePath = dbFilePath();
  const setAsidePath = `${livePath}.pre-restore-${Date.now()}`;
  console.log(`Moving current live database aside to: ${setAsidePath}`);
  await rename(livePath, setAsidePath).catch((err) => {
    if (err.code !== "ENOENT") throw err;
    console.log("(no existing live database file found — proceeding)");
  });

  console.log(`Writing restored database to: ${livePath}`);
  await writeFile(livePath, downloaded);

  console.log("\nDone. The live database file has been replaced.");
  console.log(`If anything looks wrong, the previous file is still at: ${setAsidePath}`);
  console.log("Restart the server process now for it to pick up the restored database.");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "list") {
    await listBackups();
  } else if (command === "restore") {
    const key = rest.find((a) => !a.startsWith("--"));
    const confirmed = rest.includes("--confirm");
    if (!key) {
      console.error('Usage: tsx scripts/restore-backup.ts restore "<key>" --confirm');
      process.exit(1);
    }
    await restoreBackup(key, confirmed);
  } else {
    console.error("Usage:");
    console.error("  tsx scripts/restore-backup.ts list");
    console.error('  tsx scripts/restore-backup.ts restore "<key>" --confirm');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
