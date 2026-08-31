import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import * as userRepository from "../db/userRepository.js";
import { extractBearerToken, getJwtSecret } from "../utils/optionalAuth.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      sub?: number | string;
      type?: string;
    };
    if (payload.type !== undefined && payload.type !== "access") {
      return res.status(401).json({ error: "unauthorized" });
    }
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const user = await userRepository.selectUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    req.user = { id: user.id, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
