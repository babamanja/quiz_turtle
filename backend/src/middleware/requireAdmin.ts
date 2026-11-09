import type { NextFunction, Request, Response } from "express";

import { requireAuth } from "./requireAuth.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  });
}

export async function requireTeacher(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    if ((req.user?.taughtLanguageIds.length ?? 0) === 0) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  });
}

/** Read-only catalogs (languages, tags) used by both admin screens and teacher editors. */
export async function requireTeacherOrAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    const isTeacher = (req.user?.taughtLanguageIds.length ?? 0) > 0;
    if (req.user?.role !== "admin" && !isTeacher) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  });
}
