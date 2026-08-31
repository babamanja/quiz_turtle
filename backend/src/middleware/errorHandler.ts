import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  console.error("[api] Unhandled error:", err);
  if (res.headersSent) {
    next(err);
    return;
  }
  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.statusCode === "number"
        ? err.statusCode
        : 500;
  const message = status >= 500 ? "internal_error" : "bad_request";
  res.status(status).json({ error: message });
};
