import type { Request, Response } from "express";

export type ServiceFailure = {
  ok: false;
  status: number;
  error: string;
};

export function getRequiredUserId(req: Request): number | null {
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return null;
  }
  return userId;
}

export function getUserRole(req: Request): string {
  return typeof req.user?.role === "string" ? req.user.role : "user";
}

export function getTaughtLanguageIds(req: Request): number[] {
  return req.user?.taughtLanguageIds ?? [];
}

export function sendUnauthorized(res: Response) {
  return res.status(401).json({ error: "unauthorized" });
}

export function sendServiceFailure(
  res: Response,
  result: ServiceFailure,
  extra?: Record<string, unknown>,
) {
  return res.status(result.status).json({ error: result.error, ...extra });
}
