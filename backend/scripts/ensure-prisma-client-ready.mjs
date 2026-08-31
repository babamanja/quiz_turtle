import { runPrismaGenerateIfNeeded } from "./prismaMigrate.mjs";

const result = runPrismaGenerateIfNeeded();
process.exit(result.status ?? 1);
