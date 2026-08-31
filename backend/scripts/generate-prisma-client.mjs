import { isPrismaEngineLockedError, runPrisma } from "./prismaMigrate.mjs";

const result = runPrisma(["generate"]);
if (result.status !== 0 && isPrismaEngineLockedError(result.output)) {
  console.error(
    "[db:generate] Query engine DLL is locked. Stop backend/bot dev servers, then retry.",
  );
  if (result.output.trim()) {
    process.stderr.write(`${result.output}\n`);
  }
}

process.exit(result.status ?? 1);
