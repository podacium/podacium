-- Full-text search support for modules, projects, and users
-- Uses PostgreSQL tsvector for efficient text search

-- Add tsvector columns
ALTER TABLE "Module" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS "module_search_idx" ON "Module" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "project_search_idx" ON "Project" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "user_search_idx" ON "User" USING GIN ("search_vector");

-- Populate search vectors for existing data
UPDATE "Module" SET "search_vector" = 
    setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE("description", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string("skills", ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string("tags", ' '), '')), 'C');

UPDATE "Project" SET "search_vector" = 
    setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE("description", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string("skills", ' '), '')), 'C');

UPDATE "User" SET "search_vector" = 
    setweight(to_tsvector('english', COALESCE("fullName", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE("bio", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string("skills", ' '), '')), 'C');

-- Create trigger functions to auto-update search vectors on INSERT/UPDATE

CREATE OR REPLACE FUNCTION module_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW."skills", ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW."tags", ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION project_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW."skills", ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', COALESCE(NEW."fullName", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW."bio", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW."skills", ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS module_search_update ON "Module";
CREATE TRIGGER module_search_update
    BEFORE INSERT OR UPDATE OF "title", "description", "skills", "tags"
    ON "Module" FOR EACH ROW
    EXECUTE FUNCTION module_search_vector_update();

DROP TRIGGER IF EXISTS project_search_update ON "Project";
CREATE TRIGGER project_search_update
    BEFORE INSERT OR UPDATE OF "title", "description", "skills"
    ON "Project" FOR EACH ROW
    EXECUTE FUNCTION project_search_vector_update();

DROP TRIGGER IF EXISTS user_search_update ON "User";
CREATE TRIGGER user_search_update
    BEFORE INSERT OR UPDATE OF "fullName", "bio", "skills"
    ON "User" FOR EACH ROW
    EXECUTE FUNCTION user_search_vector_update();
