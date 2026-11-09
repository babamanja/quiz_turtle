import assert from "node:assert/strict";
import test from "node:test";

import { defaultRoleForEmail } from "../src/services/adminBootstrap.service.js";

test("ADMIN_EMAIL is admin by default", () => {
  const prevEmail = process.env.ADMIN_EMAIL;
  const prevEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_EMAILS = "other@example.com";
  try {
    assert.equal(defaultRoleForEmail("Admin@Example.com"), "admin");
    assert.equal(defaultRoleForEmail("other@example.com"), "admin");
    assert.equal(defaultRoleForEmail("nope@example.com"), "user");
  } finally {
    if (prevEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prevEmail;
    if (prevEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prevEmails;
  }
});
