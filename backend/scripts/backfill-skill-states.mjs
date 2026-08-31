/**
 * Backfill skill_states from dictionary_entries for each default dictionary member.
 * Idempotent upserts.
 *
 * Usage: npm run db:backfill-skills --prefix backend
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./loadEnv.mjs";

const ALGORITHM = "pimsleur";
const BATCH = 200;

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv();
const backendEnvPath = resolve(backendDir, ".env");
if (existsSync(backendEnvPath)) {
  config({ path: backendEnvPath });
}

if (!process.env.DATABASE_URL?.trim()) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = process.env;
  if (DB_USER && DB_HOST && DB_PORT && DB_DATABASE) {
    process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
  }
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[backfill-skill-states] Missing DATABASE_URL");
  process.exit(1);
}

async function upsertSkill(prisma, row) {
  await prisma.skillState.upsert({
    where: {
      userId_vocabPairId_skillCode: {
        userId: row.userId,
        vocabPairId: row.vocabPairId,
        skillCode: row.skillCode,
      },
    },
    create: {
      userId: row.userId,
      vocabPairId: row.vocabPairId,
      skillCode: row.skillCode,
      algorithm: ALGORITHM,
      level: row.level,
      dueMs: row.dueMs,
    },
    update: {
      level: row.level,
      dueMs: row.dueMs,
      algorithm: ALGORITHM,
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  let processedMembers = 0;
  let upserts = 0;

  try {
    const memberCount = await prisma.userDictionary.count({ where: { isDefault: true } });
    console.log(`[backfill-skill-states] Default dictionary memberships: ${memberCount}`);

    let offset = 0;
    for (;;) {
      const members = await prisma.userDictionary.findMany({
        where: { isDefault: true },
        take: BATCH,
        skip: offset,
        orderBy: [{ userId: "asc" }, { dictionaryId: "asc" }],
        select: { userId: true, dictionaryId: true },
      });
      if (members.length === 0) {
        break;
      }

      for (const member of members) {
        const entries = await prisma.dictionaryEntry.findMany({
          where: { dictionaryId: member.dictionaryId },
          select: {
            vocabPairId: true,
            pimsleurLevel: true,
            nextReviewMs: true,
            pimsleurLevelReverse: true,
            nextReviewMsReverse: true,
          },
        });

        for (const entry of entries) {
          await upsertSkill(prisma, {
            userId: member.userId,
            vocabPairId: entry.vocabPairId,
            skillCode: "recall",
            level: entry.pimsleurLevel,
            dueMs: entry.nextReviewMs,
          });
          await upsertSkill(prisma, {
            userId: member.userId,
            vocabPairId: entry.vocabPairId,
            skillCode: "recall_reverse",
            level: entry.pimsleurLevelReverse,
            dueMs: entry.nextReviewMsReverse,
          });
          upserts += 2;
        }
        processedMembers += 1;
      }

      offset += members.length;
      console.log(
        `[backfill-skill-states] members=${processedMembers}/${memberCount} skill_upserts=${upserts}`,
      );
    }

    console.log(
      `[backfill-skill-states] Done. members=${processedMembers} skill_upserts=${upserts}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill-skill-states] Failed:", err);
  process.exit(1);
});
