const port = process.env.PORT?.trim() || "3002";
const url = `http://127.0.0.1:${port}/api/health`;
const timeoutMs = Number(process.env.WAIT_FOR_BACKEND_TIMEOUT_MS) || 120_000;
const intervalMs = 500;

const startedAt = Date.now();

console.log(`[wait-for-backend] Waiting for ${url}…`);

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    if (response.ok) {
      console.log(`[wait-for-backend] Backend is ready (${url})`);
      process.exit(0);
    }
  } catch {
    // Backend still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(
  `[wait-for-backend] Timed out after ${timeoutMs}ms waiting for ${url}. Check backend logs.`,
);
process.exit(1);
