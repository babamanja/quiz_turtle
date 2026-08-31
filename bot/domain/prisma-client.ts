import { PrismaClient } from "../../node_modules/@prisma/client/index.js";

let prisma: PrismaClient | null = null;

export function createPrismaClient(databaseUrl: string): PrismaClient {
  if (prisma) {
    return prisma;
  }
  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  return prisma;
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error("Prisma client is not initialized");
  }
  return prisma;
}
