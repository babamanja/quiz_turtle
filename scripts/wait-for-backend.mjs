import { get } from "node:http";

const port = process.env.PORT?.trim() || "3002";
const url = `http://127.0.0.1:${port}/api/health`;
const timeoutMs = Number(process.env.WAIT_FOR_BACKEND_TIMEOUT_MS) || 120_000;
const intervalMs = 500;

const startedAt = Date.now();

console.log(`[wait-for-backend] Waiting for ${url}…`);

function ping() {
  return new Promise((resolve) => {
    const req = get(url, { agent: false }, (res) => {
      res.resume();
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      res.on("close", () => resolve(ok));
    });
    req.setTimeout(2_000, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

while (Date.now() - startedAt < timeoutMs) {
  if (await ping()) {
    console.log(`[wait-for-backend] Backend is ready (${url})`);
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

if (Date.now() - startedAt >= timeoutMs) {
  console.error(
    `[wait-for-backend] Timed out after ${timeoutMs}ms waiting for ${url}. Check backend logs.`,
  );
  process.exit(1);
}
