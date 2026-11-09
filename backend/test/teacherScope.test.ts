import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { taughtLanguageDenied } from "../src/services/teacherScope.js";

describe("taughtLanguageDenied", () => {
  it("allows a language the teacher teaches", () => {
    assert.equal(taughtLanguageDenied([2, 5], 5), null);
  });

  it("denies a language outside the taught set", () => {
    assert.equal(taughtLanguageDenied([2], 3)?.status, 403);
  });

  it("denies a missing language", () => {
    assert.equal(taughtLanguageDenied([2], null)?.status, 403);
  });
});
