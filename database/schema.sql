-- Vse tabele so v lastni shemi petka. Brez DROP/TRUNCATE in brez posegov v druge sheme.
CREATE SCHEMA IF NOT EXISTS petka;
CREATE TABLE IF NOT EXISTS petka.meta (key text PRIMARY KEY,value text NOT NULL);
INSERT INTO petka.meta(key,value) VALUES('app','petka') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS petka.words (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 word TEXT NOT NULL UNIQUE CHECK (word ~ '^[ABCČDEFGHIJKLMNOPRSŠTUVZŽ]{5}$'),
 is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
 is_solution BOOLEAN NOT NULL DEFAULT FALSE,
 frequency BIGINT NOT NULL DEFAULT 0 CHECK (frequency>=0),
 is_lemma BOOLEAN NOT NULL DEFAULT FALSE,
 is_solution_candidate BOOLEAN NOT NULL DEFAULT FALSE,
 source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS petka.daily_puzzles (
 day DATE PRIMARY KEY,
 word_id BIGINT NOT NULL REFERENCES petka.words(id)
);
CREATE INDEX IF NOT EXISTS daily_word_idx ON petka.daily_puzzles(word_id,day);
CREATE TABLE IF NOT EXISTS petka.imports (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 source TEXT NOT NULL,
 word_count INTEGER NOT NULL,
 report JSONB NOT NULL
);

ALTER TABLE petka.words ADD COLUMN IF NOT EXISTS is_solution_candidate BOOLEAN NOT NULL DEFAULT FALSE;
