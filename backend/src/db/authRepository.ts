import { defaultRoleForEmail } from "../services/adminBootstrap.service.js";
import { getPrisma } from "./prisma.js";

export type UserAuthRow = {
  id: number;
  userName: string;
  email: string | null;
  role: "user" | "admin";
  passwordHash: string | null;
  googleSub: string | null;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
  isGuest: boolean;
};

function normalizeUserAuthRow(row: {
  user: {
    id: number;
    userName: string;
    email: string | null;
    role: string;
    deletedAt: Date | null;
    emailVerifiedAt: Date | null;
    isGuest: boolean;
  };
  passwordHash: string | null;
  googleSub: string | null;
}): UserAuthRow {
  return {
    id: row.user.id,
    userName: row.user.userName,
    email: row.user.email,
    role: row.user.role === "admin" ? "admin" : "user",
    passwordHash: row.passwordHash,
    googleSub: row.googleSub,
    deletedAt: row.user.deletedAt,
    emailVerifiedAt: row.user.emailVerifiedAt,
    isGuest: row.user.isGuest,
  };
}

export async function selectAuthByEmail(
  email: string,
): Promise<UserAuthRow | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await getPrisma().auth.findFirst({
    where: {
      OR: [
        { user: { email: normalizedEmail } },
        { user: { previousEmailForRecovery: normalizedEmail } },
      ],
    },
    include: { user: true },
  });
  return row ? normalizeUserAuthRow(row) : null;
}

export async function selectAuthByGoogleSub(
  googleSub: string,
): Promise<UserAuthRow | null> {
  const row = await getPrisma().auth.findFirst({
    where: { googleSub: googleSub.trim() },
    include: { user: true },
  });
  return row ? normalizeUserAuthRow(row) : null;
}

export async function selectAuthByUserId(
  userId: number,
): Promise<UserAuthRow | null> {
  const row = await getPrisma().auth.findFirst({
    where: { userId },
    include: { user: true },
  });
  if (row) {
    return normalizeUserAuthRow(row);
  }
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    userName: user.userName,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
    passwordHash: null,
    googleSub: null,
    deletedAt: user.deletedAt,
    emailVerifiedAt: user.emailVerifiedAt,
    isGuest: user.isGuest,
  };
}

export async function upsertPasswordAuth(input: {
  userName: string;
  email: string;
  passwordHash: string;
}): Promise<UserAuthRow> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const role = defaultRoleForEmail(normalizedEmail);
  const row = await getPrisma().user.upsert({
    where: { email: normalizedEmail },
    update: {
      userName: input.userName.trim(),
      ...(role === "admin" ? { role } : {}),
    },
    create: { userName: input.userName.trim(), email: normalizedEmail, role },
    include: { auth: true },
  });
  const auth = await getPrisma().auth.upsert({
    where: { userId: row.id },
    update: { passwordHash: input.passwordHash },
    create: { userId: row.id, passwordHash: input.passwordHash },
    include: { user: true },
  });
  return normalizeUserAuthRow(auth);
}

export async function upsertGoogleAuth(input: {
  googleSub: string;
  email: string;
  userName: string;
}): Promise<{ row: UserAuthRow; isNewUser: boolean }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const role = defaultRoleForEmail(normalizedEmail);
  const priorUser = await getPrisma().user.findUnique({
    where: { email: normalizedEmail },
  });
  const isNewUser = priorUser === null;

  const user = await getPrisma().user.upsert({
    where: { email: normalizedEmail },
    update: {
      userName: input.userName.trim(),
      emailVerifiedAt: new Date(),
      ...(role === "admin" ? { role } : {}),
    },
    create: {
      userName: input.userName.trim(),
      email: normalizedEmail,
      emailVerifiedAt: new Date(),
      role,
    },
  });
  const auth = await getPrisma().auth.upsert({
    where: { userId: user.id },
    update: { googleSub: input.googleSub.trim() },
    create: { userId: user.id, googleSub: input.googleSub.trim() },
    include: { user: true },
  });
  return { row: normalizeUserAuthRow(auth), isNewUser };
}

export async function upsertPasswordHashByUserId(
  userId: number,
  passwordHash: string,
): Promise<void> {
  await getPrisma().auth.upsert({
    where: { userId },
    update: { passwordHash },
    create: { userId, passwordHash },
  });
}

export async function markUserEmailVerified(userId: number): Promise<boolean> {
  const result = await getPrisma().user.updateMany({
    where: { id: userId, deletedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  return result.count > 0;
}
