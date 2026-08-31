-- Adaptive stories MVP: stories, tokens, unlock levels, user progress.
CREATE TYPE "StoryStatus" AS ENUM ('draft', 'published');
CREATE TYPE "StoryTokenKind" AS ENUM ('word', 'punct');

CREATE TABLE "stories" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "primary_language_id" INTEGER NOT NULL,
    "learning_language_id" INTEGER NOT NULL,
    "status" "StoryStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stories_slug_key" ON "stories"("slug");
CREATE INDEX "stories_primary_language_id_idx" ON "stories"("primary_language_id");
CREATE INDEX "stories_learning_language_id_idx" ON "stories"("learning_language_id");

ALTER TABLE "stories"
ADD CONSTRAINT "stories_primary_language_id_fkey"
FOREIGN KEY ("primary_language_id") REFERENCES "languages"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stories"
ADD CONSTRAINT "stories_learning_language_id_fkey"
FOREIGN KEY ("learning_language_id") REFERENCES "languages"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "story_sentences" (
    "id" SERIAL NOT NULL,
    "story_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_sentences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "story_sentences_story_id_sort_order_key"
ON "story_sentences"("story_id", "sort_order");

ALTER TABLE "story_sentences"
ADD CONSTRAINT "story_sentences_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "stories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "story_tokens" (
    "id" SERIAL NOT NULL,
    "sentence_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "kind" "StoryTokenKind" NOT NULL,
    "vocab_word_id" INTEGER,
    "base_form" TEXT NOT NULL,
    "l1_text" TEXT NOT NULL,
    "glue_to_previous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "story_tokens_sentence_id_sort_order_key"
ON "story_tokens"("sentence_id", "sort_order");

CREATE INDEX "story_tokens_vocab_word_id_idx" ON "story_tokens"("vocab_word_id");

ALTER TABLE "story_tokens"
ADD CONSTRAINT "story_tokens_sentence_id_fkey"
FOREIGN KEY ("sentence_id") REFERENCES "story_sentences"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "story_tokens"
ADD CONSTRAINT "story_tokens_vocab_word_id_fkey"
FOREIGN KEY ("vocab_word_id") REFERENCES "vocab_words"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "story_unlock_levels" (
    "id" SERIAL NOT NULL,
    "story_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "story_unlock_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "story_unlock_levels_story_id_level_key"
ON "story_unlock_levels"("story_id", "level");

ALTER TABLE "story_unlock_levels"
ADD CONSTRAINT "story_unlock_levels_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "stories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "story_unlock_level_words" (
    "unlock_level_id" INTEGER NOT NULL,
    "vocab_word_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "story_unlock_level_words_pkey" PRIMARY KEY ("unlock_level_id", "vocab_word_id")
);

CREATE INDEX "story_unlock_level_words_vocab_word_id_idx"
ON "story_unlock_level_words"("vocab_word_id");

ALTER TABLE "story_unlock_level_words"
ADD CONSTRAINT "story_unlock_level_words_unlock_level_id_fkey"
FOREIGN KEY ("unlock_level_id") REFERENCES "story_unlock_levels"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "story_unlock_level_words"
ADD CONSTRAINT "story_unlock_level_words_vocab_word_id_fkey"
FOREIGN KEY ("vocab_word_id") REFERENCES "vocab_words"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_story_progress" (
    "user_id" INTEGER NOT NULL,
    "story_id" INTEGER NOT NULL,
    "unlocked_level" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_story_progress_pkey" PRIMARY KEY ("user_id", "story_id")
);

CREATE INDEX "user_story_progress_story_id_idx" ON "user_story_progress"("story_id");

ALTER TABLE "user_story_progress"
ADD CONSTRAINT "user_story_progress_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_story_progress"
ADD CONSTRAINT "user_story_progress_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "stories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
