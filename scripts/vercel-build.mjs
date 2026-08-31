import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(label, args) {
  console.log(`[vercel-build] ${label}`);
  const result = spawnSync("npm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("shared", ["run", "build", "-w", "@language-turtle/shared"]);
run("backend", ["run", "build", "-w", "language-turtle-backend"]);
run("frontend", ["run", "build", "-w", "language-turtle-frontend"]);

const indexHtml = join(process.cwd(), "frontend", "dist", "index.html");
if (!existsSync(indexHtml)) {
  console.error("[vercel-build] frontend/dist/index.html was not produced");
  process.exit(1);
}
console.log("[vercel-build] OK: frontend/dist/index.html");

// Run last so a migration failure does not block the static bundle above.
run("db:deploy", ["run", "db:deploy", "-w", "language-turtle-backend"]);
