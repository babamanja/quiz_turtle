-- Baseline migration (idempotent for databases that already have ai-tutor objects).
CREATE SCHEMA IF NOT EXISTS "public";

DO $$ BEGIN
  CREATE TYPE "TokenTransactionType" AS ENUM ('purchase', 'spend', 'refund', 'bonus', 'expire', 'admin_adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentTransactionType" AS ENUM ('payment', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionPlanCode" AS ENUM ('basic', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'past_due');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "user_name" TEXT NOT NULL,
    "email" TEXT,
    "telegram_id" BIGINT,
    "telegram_username" TEXT,
    "previous_email_for_recovery" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "deleted_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "token_balance" BIGINT NOT NULL DEFAULT 0,
    "qualification_completed_at" TIMESTAMP(3),
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "primary_language_id" INTEGER,
    "learning_language_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "telegram_link_codes" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "token_ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "delta" BIGINT NOT NULL,
    "balance_after" BIGINT,
    "transaction_type" "TokenTransactionType" NOT NULL,
    "reference_id" TEXT,
    "idempotency_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payments" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'succeeded',
    "provider" TEXT,
    "provider_transaction_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "original_payment_id" UUID,
    "refund_reason" TEXT,
    "transaction_type" "PaymentTransactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan_code" "SubscriptionPlanCode" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_id" UUID,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "auth" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "password_hash" TEXT,
    "google_sub" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "ai_usage_analytics" (
    "id" UUID NOT NULL,
    "user_id" INTEGER,
    "feature" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL,
    "source_text_length" INTEGER NOT NULL DEFAULT 0,
    "estimated_tokens" INTEGER NOT NULL DEFAULT 0,
    "ai_input_tokens" INTEGER,
    "ai_output_tokens" INTEGER,
    "ai_total_tokens" INTEGER,
    "ai_model" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_analytics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "qualification_submissions" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_feedback" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "languages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vocab_words" (
    "id" SERIAL NOT NULL,
    "language_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "vocab_words_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vocab_pairs" (
    "id" SERIAL NOT NULL,
    "primary_word_id" INTEGER NOT NULL,
    "learning_word_id" INTEGER NOT NULL,

    CONSTRAINT "vocab_pairs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_pairs" (
    "user_id" INTEGER NOT NULL,
    "vocab_pair_id" INTEGER NOT NULL,
    "pimsleur_level" INTEGER NOT NULL DEFAULT 0,
    "next_review_ms" BIGINT NOT NULL,

    CONSTRAINT "user_pairs_pkey" PRIMARY KEY ("user_id","vocab_pair_id")
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" BIGINT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_username" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "previous_email_for_recovery" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_guest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "primary_language_id" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "learning_language_id" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_key" ON "users"("telegram_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_previous_email_for_recovery_key" ON "users"("previous_email_for_recovery");
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_link_codes_code_key" ON "telegram_link_codes"("code");
CREATE INDEX IF NOT EXISTS "telegram_link_codes_user_id_created_at_idx" ON "telegram_link_codes"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "token_ledger_entries_idempotency_key_key" ON "token_ledger_entries"("idempotency_key");
CREATE INDEX IF NOT EXISTS "token_ledger_entries_user_id_created_at_idx" ON "token_ledger_entries"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "token_ledger_entries_transaction_type_created_at_idx" ON "token_ledger_entries"("transaction_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payments_user_id_date_idx" ON "payments"("user_id", "date" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "auth_user_id_key" ON "auth"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "auth_google_sub_key" ON "auth"("google_sub");
CREATE INDEX IF NOT EXISTS "ai_usage_analytics_created_at_idx" ON "ai_usage_analytics"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_usage_analytics_user_id_created_at_idx" ON "ai_usage_analytics"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "qualification_submissions_user_id_key" ON "qualification_submissions"("user_id");
CREATE INDEX IF NOT EXISTS "qualification_submissions_submitted_at_idx" ON "qualification_submissions"("submitted_at" DESC);
CREATE INDEX IF NOT EXISTS "user_feedback_user_id_created_at_idx" ON "user_feedback"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "user_feedback_created_at_idx" ON "user_feedback"("created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "languages_name_key" ON "languages"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "vocab_words_language_id_text_key" ON "vocab_words"("language_id", "text");
CREATE UNIQUE INDEX IF NOT EXISTS "vocab_pairs_primary_word_id_learning_word_id_key" ON "vocab_pairs"("primary_word_id", "learning_word_id");

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_primary_language_id_fkey" FOREIGN KEY ("primary_language_id") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_learning_language_id_fkey" FOREIGN KEY ("learning_language_id") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_original_payment_id_fkey" FOREIGN KEY ("original_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "auth" ADD CONSTRAINT "auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_usage_analytics" ADD CONSTRAINT "ai_usage_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "qualification_submissions" ADD CONSTRAINT "qualification_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vocab_words" ADD CONSTRAINT "vocab_words_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vocab_pairs" ADD CONSTRAINT "vocab_pairs_primary_word_id_fkey" FOREIGN KEY ("primary_word_id") REFERENCES "vocab_words"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vocab_pairs" ADD CONSTRAINT "vocab_pairs_learning_word_id_fkey" FOREIGN KEY ("learning_word_id") REFERENCES "vocab_words"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_pairs" ADD CONSTRAINT "user_pairs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_pairs" ADD CONSTRAINT "user_pairs_vocab_pair_id_fkey" FOREIGN KEY ("vocab_pair_id") REFERENCES "vocab_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
