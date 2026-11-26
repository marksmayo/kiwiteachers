// Creates the app tables (Better Auth tables are created by `npx auth migrate`).
// Usage: node --env-file=.env.local scripts/migrate.mjs
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();

await client.query(`
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION kt_join(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT coalesce(array_to_string($1, ' '), '') $$;

CREATE TABLE IF NOT EXISTS resource (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  blob_pathname  text NOT NULL,
  thumb_pathname text,
  file_size      integer NOT NULL DEFAULT 0,
  page_count     integer NOT NULL DEFAULT 1,
  years          integer[] NOT NULL DEFAULT '{}',
  learning_areas text[] NOT NULL DEFAULT '{}',
  resource_type  text NOT NULL,
  tags           text[] NOT NULL DEFAULT '{}',
  uploaded_by    text,
  view_count     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  search         tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', kt_join(tags)), 'A') ||
    setweight(to_tsvector('english', description), 'B')
  ) STORED
);

CREATE INDEX IF NOT EXISTS resource_search_idx ON resource USING gin (search);
CREATE INDEX IF NOT EXISTS resource_title_trgm_idx ON resource USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS resource_years_idx ON resource USING gin (years);
CREATE INDEX IF NOT EXISTS resource_areas_idx ON resource USING gin (learning_areas);
CREATE INDEX IF NOT EXISTS resource_tags_idx ON resource USING gin (tags);
CREATE INDEX IF NOT EXISTS resource_created_idx ON resource (created_at DESC);

CREATE TABLE IF NOT EXISTS favourite (
  user_id     text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);
CREATE INDEX IF NOT EXISTS favourite_resource_idx ON favourite (resource_id);

-- Downloads + cached rating aggregates
ALTER TABLE resource ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;
ALTER TABLE resource ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2);
ALTER TABLE resource ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS resource_rating_idx ON resource (rating_avg DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS rating (
  user_id     text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  score       numeric(2,1) NOT NULL CHECK (score >= 0.5 AND score <= 5 AND score * 2 = floor(score * 2)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);
CREATE INDEX IF NOT EXISTS rating_resource_idx ON rating (resource_id);

-- Keep aggregates correct even when users are deleted (cascade)
CREATE OR REPLACE FUNCTION kt_refresh_rating() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid uuid := coalesce(NEW.resource_id, OLD.resource_id);
BEGIN
  UPDATE resource SET
    rating_avg = (SELECT round(avg(score), 2) FROM rating WHERE resource_id = rid),
    rating_count = (SELECT count(*) FROM rating WHERE resource_id = rid)
  WHERE id = rid;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS rating_refresh ON rating;
CREATE TRIGGER rating_refresh AFTER INSERT OR UPDATE OR DELETE ON rating
  FOR EACH ROW EXECUTE FUNCTION kt_refresh_rating();
`);

console.log("App tables ready.");
await client.end();
