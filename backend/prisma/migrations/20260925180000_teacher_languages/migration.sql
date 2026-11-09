-- CreateTable
CREATE TABLE "teacher_languages" (
    "user_id" INTEGER NOT NULL,
    "language_id" INTEGER NOT NULL,

    CONSTRAINT "teacher_languages_pkey" PRIMARY KEY ("user_id","language_id")
);

-- AddForeignKey
ALTER TABLE "teacher_languages" ADD CONSTRAINT "teacher_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_languages" ADD CONSTRAINT "teacher_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
