/**
 * @fileoverview Clear all converter queue data from Redis.
 *
 * Removes all Redis keys related to the converter queue:
 * - Version jobs (converter:vjob:*)
 * - File tracking records (converter:file:*)
 * - File sets per job (converter:files:*)
 * - Status sets (converter:vjob:status:*)
 * - Active job pointers (converter:version:active_job:*)
 * - Manual trigger flag (converter:manual_trigger)
 * - Waiting queue (converter:vjob:waiting)
 * - All jobs set (converter:vjob:all)
 *
 * Usage:
 *   npx tsx src/scripts/clear-converter-queue.ts
 *
 * @module scripts/clear-converter-queue
 */
import { createClient } from "redis";
import { config } from "@/shared/config/index.js";

/** All converter key patterns to scan and delete */
const CONVERTER_KEY_PATTERNS = [
  "converter:vjob:*",
  "converter:file:*",
  "converter:files:*",
  "converter:version:active_job:*",
  "converter:manual_trigger",
  "converter:schedule:config",
];

/**
 * Find Redis keys matching a pattern and delete them.
 * Uses KEYS command — fine for a one-off cleanup script.
 * @param client - Redis client
 * @param pattern - Glob pattern to match
 * @returns Number of keys deleted
 */
async function deleteByPattern(
  client: ReturnType<typeof createClient>,
  pattern: string,
): Promise<number> {
  const keys = await client.keys(pattern);
  if (keys.length === 0) return 0;

  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    await client.del(batch);
  }

  return keys.length;
}

/**
 * Main function — connects to Redis and clears all converter queue data.
 */
async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Clear Converter Queue — Redis Cleanup Script");
  console.log("═══════════════════════════════════════════════════");
  console.log();

  // Connect to Redis using app config
  const redisUrl = config.redis?.url;
  if (!redisUrl) {
    console.error("❌ Redis URL not configured. Check your .env file.");
    process.exit(1);
  }

  console.log(`Connecting to Redis: ${redisUrl.replace(/:[^:@]*@/, ":***@")}`);
  const client = createClient({ url: redisUrl });

  client.on("error", (err) => {
    console.error("Redis error:", err.message);
  });

  try {
    await client.connect();
    console.log("✅ Connected to Redis");
    console.log();

    let totalDeleted = 0;

    // Delete all converter keys by pattern
    for (const pattern of CONVERTER_KEY_PATTERNS) {
      const count = await deleteByPattern(client, pattern);
      if (count > 0) {
        console.log(`  🗑  Deleted ${count} key(s) matching: ${pattern}`);
      } else {
        console.log(`  ⚪ No keys found for: ${pattern}`);
      }
      totalDeleted += count;
    }

    console.log();
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`  Total keys deleted: ${totalDeleted}`);
    console.log(`═══════════════════════════════════════════════════`);
    console.log();
    console.log("✅ Converter queue cleared successfully.");
  } catch (err) {
    console.error("❌ Failed to clear queue:", (err as Error).message);
    process.exit(1);
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }

  process.exit(0);
}

main();
