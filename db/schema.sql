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

-- ── Roles: admin rights live in the DB, not in an unverifiable email ──
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- ── Contributor submissions + approval queue ──
ALTER TABLE resource ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE resource ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE resource ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE resource ADD COLUMN IF NOT EXISTS rejection_reason text;
DO $$ BEGIN
  ALTER TABLE resource ADD CONSTRAINT resource_status_chk CHECK (status IN ('pending', 'published', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS resource_status_idx ON resource (status);
CREATE INDEX IF NOT EXISTS resource_uploader_idx ON resource (uploaded_by);

-- ── Te Mātaiaho curriculum codes ──
ALTER TABLE resource ADD COLUMN IF NOT EXISTS curriculum_codes text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS resource_codes_idx ON resource USING gin (curriculum_codes);

-- ── Written reviews (attached to the rating row) + moderation ──
ALTER TABLE rating ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE rating ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'published';
ALTER TABLE rating ADD COLUMN IF NOT EXISTS flag_reasons text[] NOT NULL DEFAULT '{}';
ALTER TABLE rating ADD COLUMN IF NOT EXISTS moderated_by text;
ALTER TABLE rating ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
DO $$ BEGIN
  ALTER TABLE rating ADD CONSTRAINT rating_review_status_chk CHECK (review_status IN ('published', 'flagged', 'hidden'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS rating_review_status_idx ON rating (review_status) WHERE body IS NOT NULL;

-- ── Download log (daily limits) ──
CREATE TABLE IF NOT EXISTS download (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS download_user_time_idx ON download (user_id, created_at DESC);

-- ── Watermarked preview images (one per page), generated at upload ──
ALTER TABLE resource ADD COLUMN IF NOT EXISTS preview_pathnames text[] NOT NULL DEFAULT '{}';

-- ── Upload token log (rate-limits direct-to-Blob uploads) ──
CREATE TABLE IF NOT EXISTS upload_token (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS upload_token_user_time_idx ON upload_token (user_id, created_at DESC);
