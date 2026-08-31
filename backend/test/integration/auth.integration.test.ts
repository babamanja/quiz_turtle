import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/app.js";
import { applyHttpTestEnv } from "../helpers/testEnv.js";

applyHttpTestEnv();

test("POST /api/auth/signup/password rejects missing fields", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/signup/password").send({});
  assert.equal(res.status, 400);
  assert.equal(res.body?.error, "userName, email, password required");
});

test("POST /api/auth/signup/password rejects invalid email", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/signup/password").send({
    userName: "Test User",
    email: "not-an-email",
    password: "password123",
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.error, "invalid email");
});

test("POST /api/auth/signup/password rejects short password", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/signup/password").send({
    userName: "Test User",
    email: "user@example.com",
    password: "short",
  });
  assert.equal(res.status, 400);
  assert.match(String(res.body?.error), /at least 8 characters/);
});

test("POST /api/auth/login/password rejects missing credentials", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/login/password").send({});
  assert.equal(res.status, 400);
  assert.equal(res.body?.error, "email, password required");
});

test("POST /api/auth/login/password rejects invalid email format", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/login/password").send({
    email: "bad-email",
    password: "password123",
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.error, "invalid email");
});

test("GET /api/auth/me without Authorization returns 401", async () => {
  const app = createApp();
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.status, 401);
});

test("GET /api/auth/me rejects malformed bearer token", async () => {
  const app = createApp();
  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer not-a-valid-jwt");
  assert.equal(res.status, 401);
});

test("GET /api/auth/me rejects access token with wrong type", async () => {
  const app = createApp();
  const token = jwt.sign({ sub: 1, type: "refresh" }, process.env.AUTH_JWT_SECRET!, {
    expiresIn: "15m",
  });
  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 401);
});

test("POST /api/auth/refresh without cookie returns 401", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/refresh");
  assert.equal(res.status, 401);
});

test("POST /api/auth/logout clears session cookie", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/logout");
  assert.equal(res.status, 204);
  const setCookie = res.headers["set-cookie"];
  assert.ok(setCookie);
  const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  assert.match(cookieHeader, /languageTurtleRefreshToken=/);
});

test("GET /api/users/me/dashboard-stats without Authorization returns 401", async () => {
  const app = createApp();
  const res = await request(app).get("/api/users/me/dashboard-stats");
  assert.equal(res.status, 401);
});
