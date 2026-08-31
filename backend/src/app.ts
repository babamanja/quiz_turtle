import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { collectConfiguredOrigins } from "./config/publicOrigins.js";
import * as subscriptionController from "./controllers/subscription.controller.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { webhookRateLimiter } from "./middleware/rateLimit.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import telegramRoutes from "./routes/telegram.routes.js";
import internalRoutes from "./routes/internal.routes.js";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:4174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:4174",
] as const;

function getAllowedOrigins(): Set<string> {
  const set = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  for (const origin of collectConfiguredOrigins()) {
    set.add(origin);
  }
  return set;
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const isHostedProxy = process.env.VERCEL === "1" || process.env.APP_ENV === "prod";

  if (isHostedProxy) {
    app.set("trust proxy", 1);
  }

  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(
    cors({
      credentials: true,
      origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin) {
          callback(null, true);
          return;
        }
        callback(null, allowedOrigins.has(origin));
      },
    }),
  );
  app.post(
    "/api/subscriptions/provider/paddle/webhook",
    webhookRateLimiter,
    express.raw({ type: "application/json", limit: "1mb" }),
    (req: Request, _res: Response, next: NextFunction) => {
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
      }
      next();
    },
    asyncHandler(subscriptionController.handlePaddleWebhook),
  );

  app.use(
    express.json({
      limit: "5mb",
      verify(req: Request, _res: Response, buf: Buffer) {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/subscriptions", subscriptionRoutes);
  app.use("/api/feedback", feedbackRoutes);
  app.use("/api/telegram", telegramRoutes);
  app.use("/api/internal", internalRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(errorHandler);

  return app;
}
