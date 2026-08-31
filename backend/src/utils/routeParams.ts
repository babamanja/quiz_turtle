import type { Request } from "express";

export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return "";
}
