-- Learning engine Phase 1: sparse SkillState alongside DictionaryEntry (dual-write era).
CREATE TABLE "skill_states" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "vocab_pair_id" INTEGER NOT NULL,
    "skill_code" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'pimsleur',
    "level" INTEGER NOT NULL DEFAULT 0,
    "due_ms" BIGINT NOT NULL,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_states_user_id_vocab_pair_id_skill_code_key"
ON "skill_states"("user_id", "vocab_pair_id", "skill_code");

CREATE INDEX "skill_states_user_id_due_ms_idx"
ON "skill_states"("user_id", "due_ms");

ALTER TABLE "skill_states"
ADD CONSTRAINT "skill_states_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_states"
ADD CONSTRAINT "skill_states_vocab_pair_id_fkey"
FOREIGN KEY ("vocab_pair_id") REFERENCES "vocab_pairs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
