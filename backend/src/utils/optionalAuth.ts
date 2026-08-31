import jwt from "jsonwebtoken";

export function getJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is required");
  }
  return secret;
}

export function extractBearerToken(headerValue: unknown): string {
  if (typeof headerValue !== "string") {
    return "";
  }
  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
}

export function extractAccessToken(req: {
  headers?: { authorization?: string | string[] };
}): string | null {
  const header = req.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const token = extractBearerToken(value);
  return token.length > 0 ? token : null;
}

export function decodeAccessUserId(token: string): number | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      sub?: number | string;
      type?: string;
    };
    if (payload.type !== "access") {
      return null;
    }
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

export function resolveOptionalAccessUserId(req: {
  headers?: { authorization?: string | string[] };
}): number | null {
  const token = extractAccessToken(req);
  if (!token) {
    return null;
  }
  return decodeAccessUserId(token);
}
