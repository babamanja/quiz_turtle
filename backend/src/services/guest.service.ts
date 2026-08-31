import { randomUUID } from "node:crypto";

import * as authRepository from "../db/authRepository.js";
import * as subscriptionRepository from "../db/subscriptionRepository.js";
import * as userRepository from "../db/userRepository.js";
import { getPrisma } from "../db/prisma.js";
import * as dictionaryRepository from "../db/dictionaryRepository.js";

const GUEST_EMAIL_DOMAIN = "guest.languageturtle.local";

export async function createGuestUser() {
  const email = `guest+${randomUUID()}@${GUEST_EMAIL_DOMAIN}`;
  const user = await getPrisma().user.create({
    data: {
      userName: "Guest",
      email,
      isGuest: true,
    },
  });
  await dictionaryRepository.ensureDefaultDictionaryForUser(user.id);
  await subscriptionRepository.ensureDefaultBasicSubscription(user.id);
  const authRow = await authRepository.selectAuthByUserId(user.id);
  if (!authRow) {
    throw new Error("guest user auth row missing");
  }
  return authRow;
}

export async function isGuestUser(userId: number): Promise<boolean> {
  return userRepository.isGuestUser(userId);
}

async function emailTakenByAnotherUser(email: string, excludeUserId: number): Promise<boolean> {
  const existing = await authRepository.selectAuthByEmail(email);
  if (!existing || existing.id === excludeUserId) {
    return false;
  }
  return !existing.deletedAt;
}

export async function convertGuestWithPassword(input: {
  guestUserId: number;
  userName: string;
  email: string;
  passwordHash: string;
}): Promise<
  | { ok: true; row: import("../db/authRepository.js").UserAuthRow }
  | { ok: false; status: number; error: string }
> {
  const guest = await getPrisma().user.findFirst({
    where: { id: input.guestUserId, isGuest: true, deletedAt: null },
  });
  if (!guest) {
    return { ok: false, status: 400, error: "invalid guest session" };
  }

  const email = input.email.trim().toLowerCase();
  if (await emailTakenByAnotherUser(email, input.guestUserId)) {
    return { ok: false, status: 409, error: "email already registered" };
  }

  await getPrisma().user.update({
    where: { id: input.guestUserId },
    data: {
      userName: input.userName.trim(),
      email,
      isGuest: false,
    },
  });
  await authRepository.upsertPasswordHashByUserId(input.guestUserId, input.passwordHash);
  const row = await authRepository.selectAuthByUserId(input.guestUserId);
  if (!row) {
    return { ok: false, status: 500, error: "signup failed" };
  }
  await subscriptionRepository.ensureDefaultBasicSubscription(input.guestUserId);
  return { ok: true, row };
}

export async function convertGuestWithGoogle(input: {
  guestUserId: number;
  googleSub: string;
  email: string;
  userName: string;
}): Promise<
  | { ok: true; row: import("../db/authRepository.js").UserAuthRow }
  | { ok: false; status: number; error: string }
> {
  const guest = await getPrisma().user.findFirst({
    where: { id: input.guestUserId, isGuest: true, deletedAt: null },
  });
  if (!guest) {
    return { ok: false, status: 400, error: "invalid guest session" };
  }

  const email = input.email.trim().toLowerCase();
  if (await emailTakenByAnotherUser(email, input.guestUserId)) {
    return { ok: false, status: 409, error: "email already registered" };
  }

  await getPrisma().user.update({
    where: { id: input.guestUserId },
    data: {
      userName: input.userName.trim(),
      email,
      isGuest: false,
      emailVerifiedAt: new Date(),
    },
  });
  await getPrisma().auth.upsert({
    where: { userId: input.guestUserId },
    update: { googleSub: input.googleSub.trim() },
    create: {
      userId: input.guestUserId,
      googleSub: input.googleSub.trim(),
    },
  });
  const row = await authRepository.selectAuthByUserId(input.guestUserId);
  if (!row) {
    return { ok: false, status: 500, error: "signup failed" };
  }
  await subscriptionRepository.ensureDefaultBasicSubscription(input.guestUserId);
  return { ok: true, row };
}

export async function mergeGuestIntoUser(guestUserId: number, targetUserId: number): Promise<void> {
  if (guestUserId === targetUserId) {
    return;
  }
  const guest = await getPrisma().user.findFirst({
    where: { id: guestUserId, isGuest: true, deletedAt: null },
  });
  if (!guest) {
    return;
  }

  await getPrisma().user.update({
    where: { id: guestUserId },
    data: {
      deletedAt: new Date(),
      email: `deleted+guest+${guestUserId}+${Date.now()}@deleted.local`,
    },
  });
}
