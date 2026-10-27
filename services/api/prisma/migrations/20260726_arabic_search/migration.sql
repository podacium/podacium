-- Switch PostgreSQL full-text search from 'english' to 'simple' configuration
-- 'simple' tokenizes without stemming, supporting all languages including Arabic

CREATE OR REPLACE FUNCTION module_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('simple', COALESCE(NEW."title", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW."description", '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW."skills", ' '), '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW."tags", ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION project_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('simple', COALESCE(NEW."title", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW."description", '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW."skills", ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('simple', COALESCE(NEW."fullName", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW."bio", '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW."skills", ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Regenerate search vectors for existing data
UPDATE "Module" SET "search_vector" = 
    setweight(to_tsvector('simple', COALESCE("title", '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE("description", '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string("skills", ' '), '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string("tags", ' '), '')), 'C');

UPDATE "Project" SET "search_vector" = 
    setweight(to_tsvector('simple', COALESCE("title", '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE("description", '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string("skills", ' '), '')), 'C');

UPDATE "User" SET "search_vector" = 
    setweight(to_tsvector('simple', COALESCE("fullName", '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE("bio", '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string("skills", ' '), '')), 'C');
