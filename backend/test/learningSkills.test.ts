import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { skillCodeForDirection } from "@language-turtle/shared";

describe("learningSkills mapping", () => {
  it("maps directions to skills", () => {
    assert.equal(skillCodeForDirection("learning_to_primary"), "recall");
    assert.equal(skillCodeForDirection("primary_to_learning"), "recall_reverse");
  });
});
