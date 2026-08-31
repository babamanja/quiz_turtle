import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveUnlockedWordIds } from "@language-turtle/shared";
import {
  clampUnlockedLevel,
  computeStoryProgress,
  maxUnlockLevel,
  validateStoryContent,
} from "../src/services/story.service.js";
import type { StoryGraphRow } from "../src/db/storyRepository.js";

function validContent(overrides?: {
  sentences?: unknown;
  unlockLevels?: unknown;
}) {
  return {
    sentences: overrides?.sentences ?? [
      {
        sortOrder: 0,
        tokens: [
          {
            sortOrder: 0,
            kind: "word",
            vocabWordId: 10,
            baseForm: "hola",
            l1Text: "hello",
          },
          {
            sortOrder: 1,
            kind: "punct",
            baseForm: "!",
            l1Text: "!",
            glueToPrevious: true,
          },
          {
            sortOrder: 2,
            kind: "word",
            vocabWordId: 20,
            baseForm: "mundo",
            l1Text: "world",
          },
        ],
      },
    ],
    unlockLevels: overrides?.unlockLevels ?? [
      { level: 1, label: "Basics", wordIds: [10] },
      { level: 2, wordIds: [20] },
    ],
  };
}

function fakeStory(overrides?: {
  unlockLevels?: StoryGraphRow["unlockLevels"];
  tokens?: StoryGraphRow["sentences"][number]["tokens"];
}): StoryGraphRow {
  const tokens =
    overrides?.tokens ??
    ([
      {
        id: 1,
        sentenceId: 1,
        sortOrder: 0,
        kind: "word" as const,
        vocabWordId: 10,
        baseForm: "hola",
        l1Text: "hello",
        glueToPrevious: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: 2,
        sentenceId: 1,
        sortOrder: 1,
        kind: "word" as const,
        vocabWordId: 20,
        baseForm: "mundo",
        l1Text: "world",
        glueToPrevious: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ] satisfies StoryGraphRow["sentences"][number]["tokens"]);

  const unlockLevels =
    overrides?.unlockLevels ??
    ([
      {
        id: 1,
        storyId: 1,
        level: 1,
        label: "Basics",
        words: [{ unlockLevelId: 1, vocabWordId: 10, sortOrder: 0 }],
      },
      {
        id: 2,
        storyId: 1,
        level: 2,
        label: null,
        words: [{ unlockLevelId: 2, vocabWordId: 20, sortOrder: 0 }],
      },
    ] satisfies StoryGraphRow["unlockLevels"]);

  return {
    id: 1,
    title: "Demo",
    slug: null,
    primaryLanguageId: 1,
    learningLanguageId: 2,
    status: "published",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    sentences: [
      {
        id: 1,
        storyId: 1,
        sortOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        tokens,
      },
    ],
    unlockLevels,
  };
}

describe("validateStoryContent", () => {
  it("accepts a valid payload", () => {
    const result = validateStoryContent(validContent());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.content.unlockLevels.length, 2);
      assert.equal(result.content.sentences[0]!.tokens.length, 3);
    }
  });

  it("requires vocabWordId for word tokens", () => {
    const result = validateStoryContent(
      validContent({
        sentences: [
          {
            sortOrder: 0,
            tokens: [
              {
                sortOrder: 0,
                kind: "word",
                baseForm: "hola",
                l1Text: "hello",
              },
            ],
          },
        ],
        unlockLevels: [],
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.error, /vocabWordId/);
    }
  });

  it("rejects unlock wordIds outside story tokens", () => {
    const result = validateStoryContent(
      validContent({
        unlockLevels: [{ level: 1, wordIds: [10, 999] }],
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.error, /not used in story word tokens/);
    }
  });

  it("requires unlock levels contiguous from 1", () => {
    const result = validateStoryContent(
      validContent({
        unlockLevels: [
          { level: 1, wordIds: [10] },
          { level: 3, wordIds: [20] },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.error, /contiguous from 1/);
    }
  });

  it("allows empty unlock levels", () => {
    const result = validateStoryContent(validContent({ unlockLevels: [] }));
    assert.equal(result.ok, true);
  });

  it("allows punct without vocabWordId", () => {
    const result = validateStoryContent(
      validContent({
        sentences: [
          {
            sortOrder: 0,
            tokens: [
              {
                sortOrder: 0,
                kind: "punct",
                baseForm: ".",
                l1Text: ".",
              },
            ],
          },
        ],
        unlockLevels: [],
      }),
    );
    assert.equal(result.ok, true);
  });
});

describe("story progress helpers", () => {
  it("clamps unlocked level to maxLevel", () => {
    assert.equal(clampUnlockedLevel(5, 2), 2);
    assert.equal(clampUnlockedLevel(-1, 2), 0);
    assert.equal(clampUnlockedLevel(1, 0), 0);
    assert.equal(maxUnlockLevel([{ level: 1 }, { level: 3 }]), 3);
  });

  it("computes percent from unique unlocked words", () => {
    const story = fakeStory();
    const atZero = computeStoryProgress(0, story);
    assert.equal(atZero.unlockedLevel, 0);
    assert.equal(atZero.maxLevel, 2);
    assert.deepEqual(atZero.unlockedWordIds, []);
    assert.equal(atZero.percent, 0);

    const atOne = computeStoryProgress(1, story);
    assert.deepEqual(atOne.unlockedWordIds, [10]);
    assert.equal(atOne.percent, 50);

    const atTwo = computeStoryProgress(2, story);
    assert.deepEqual(atTwo.unlockedWordIds, [10, 20]);
    assert.equal(atTwo.percent, 100);

    const clamped = computeStoryProgress(9, story);
    assert.equal(clamped.unlockedLevel, 2);
    assert.equal(clamped.percent, 100);
  });

  it("resolves unlocked word ids via shared helper", () => {
    const ids = resolveUnlockedWordIds(1, [
      { level: 1, wordIds: [10, 11] },
      { level: 2, wordIds: [20] },
    ]);
    assert.deepEqual(ids.sort((a, b) => a - b), [10, 11]);
  });

  it("clamps next-level increments to maxLevel", () => {
    const maxLevel = 2;
    let unlocked = 0;
    unlocked = clampUnlockedLevel(unlocked + 1, maxLevel);
    assert.equal(unlocked, 1);
    unlocked = clampUnlockedLevel(unlocked + 1, maxLevel);
    assert.equal(unlocked, 2);
    unlocked = clampUnlockedLevel(unlocked + 1, maxLevel);
    assert.equal(unlocked, 2);
  });
});
