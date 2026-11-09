ALTER TABLE "dictionaries" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dictionaries" ADD COLUMN "verified_at" TIMESTAMP(3);

ALTER TABLE "vocab_pairs" ADD COLUMN "author_id" INTEGER;
ALTER TABLE "vocab_pairs" ADD COLUMN "published_at" TIMESTAMP(3);
ALTER TABLE "vocab_pairs" ADD COLUMN "verified_at" TIMESTAMP(3);

ALTER TABLE "stories" ADD COLUMN "author_id" INTEGER;
ALTER TABLE "stories" ADD COLUMN "verified_at" TIMESTAMP(3);

-- Existing catalog stories were staff-published.
UPDATE "stories" SET "verified_at" = "created_at" WHERE "status" = 'published';

ALTER TABLE "vocab_words" ADD COLUMN "author_id" INTEGER;
ALTER TABLE "vocab_words" ADD COLUMN "verified_at" TIMESTAMP(3);
ALTER TABLE "vocab_words" ADD CONSTRAINT "vocab_words_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vocab_pairs" ADD CONSTRAINT "vocab_pairs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "vocab_pairs_published_at_idx" ON "vocab_pairs"("published_at");
CREATE INDEX "stories_author_id_idx" ON "stories"("author_id");
CREATE INDEX "dictionaries_is_public_idx" ON "dictionaries"("is_public");
