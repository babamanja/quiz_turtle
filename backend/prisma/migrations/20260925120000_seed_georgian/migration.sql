INSERT INTO "languages" ("name")
VALUES ('Georgian')
ON CONFLICT ("name") DO NOTHING;
