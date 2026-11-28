-- Gerado por `moodletracker db schema`. Não edite à mão: a fonte é src/moodletracker/db/tables.py
-- embedding_dim=768
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE event_level AS ENUM ('info', 'warning', 'error');
CREATE TYPE item_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'duplicate');
CREATE TYPE item_type AS ENUM ('pdf', 'pptx', 'html', 'other');
CREATE TYPE pipeline_stage AS ENUM ('discovered', 'extracted', 'markdown', 'chunked', 'embedded', 'drafted');
CREATE TYPE review_status AS ENUM ('unreviewed', 'approved', 'needs_changes');
CREATE TYPE run_status AS ENUM ('running', 'succeeded', 'failed', 'skipped');
CREATE TYPE run_trigger AS ENUM ('scheduler', 'manual', 'cli');

CREATE TABLE courses (
	id SERIAL NOT NULL, 
	name TEXT NOT NULL, 
	slug VARCHAR(80) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name), 
	UNIQUE (slug)
);

CREATE TABLE pipeline_runs (
	id BIGSERIAL NOT NULL, 
	trigger run_trigger NOT NULL, 
	status run_status NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	stats JSONB DEFAULT '{}'::jsonb NOT NULL, 
	error TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE schema_info (
	key VARCHAR(64) NOT NULL, 
	value TEXT NOT NULL, 
	PRIMARY KEY (key)
);

CREATE TABLE items (
	id BIGSERIAL NOT NULL, 
	course_id INTEGER NOT NULL, 
	module TEXT NOT NULL, 
	title TEXT NOT NULL, 
	item_type item_type NOT NULL, 
	source_adapter VARCHAR(32) NOT NULL, 
	source_id TEXT NOT NULL, 
	source_uri TEXT NOT NULL, 
	local_path TEXT NOT NULL, 
	content_hash VARCHAR(64) NOT NULL, 
	size_bytes BIGINT NOT NULL, 
	stage pipeline_stage NOT NULL, 
	status item_status NOT NULL, 
	error TEXT, 
	attempts INTEGER DEFAULT '0' NOT NULL, 
	duplicate_of_id BIGINT, 
	review_status review_status DEFAULT 'unreviewed' NOT NULL, 
	review_note TEXT, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	summary TEXT, 
	collected_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	modified_at TIMESTAMP WITH TIME ZONE, 
	processed_at TIMESTAMP WITH TIME ZONE, 
	metadata JSONB DEFAULT '{}'::jsonb NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_items_source UNIQUE (source_adapter, source_id), 
	CONSTRAINT ck_items_hash_format CHECK (content_hash ~ '^[0-9a-f]{64}$'), 
	CONSTRAINT ck_items_attempts CHECK (attempts >= 0), 
	FOREIGN KEY(course_id) REFERENCES courses (id) ON DELETE CASCADE, 
	FOREIGN KEY(duplicate_of_id) REFERENCES items (id) ON DELETE SET NULL
);
CREATE INDEX ix_items_content_hash ON items (content_hash);
CREATE INDEX ix_items_course_created ON items (course_id, created_at DESC);
CREATE INDEX ix_items_review ON items (review_status);
CREATE INDEX ix_items_status_stage ON items (status, stage);
CREATE UNIQUE INDEX uq_items_canonical_hash ON items (content_hash) WHERE duplicate_of_id IS NULL;

CREATE TABLE documents (
	id BIGSERIAL NOT NULL, 
	item_id BIGINT NOT NULL, 
	ordinal INTEGER NOT NULL, 
	title TEXT NOT NULL, 
	path TEXT NOT NULL, 
	locator TEXT DEFAULT '' NOT NULL, 
	content_hash VARCHAR(64) NOT NULL, 
	char_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_documents_item_ordinal UNIQUE (item_id, ordinal), 
	FOREIGN KEY(item_id) REFERENCES items (id) ON DELETE CASCADE, 
	UNIQUE (path)
);
CREATE INDEX ix_documents_item_id ON documents (item_id);

CREATE TABLE item_events (
	id BIGSERIAL NOT NULL, 
	item_id BIGINT, 
	run_id BIGINT, 
	kind VARCHAR(48) NOT NULL, 
	stage pipeline_stage, 
	level event_level NOT NULL, 
	message TEXT NOT NULL, 
	data JSONB DEFAULT '{}'::jsonb NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(item_id) REFERENCES items (id) ON DELETE CASCADE, 
	FOREIGN KEY(run_id) REFERENCES pipeline_runs (id) ON DELETE SET NULL
);
CREATE INDEX ix_item_events_created ON item_events (id DESC);
CREATE INDEX ix_item_events_item_id ON item_events (item_id);

CREATE TABLE chunks (
	id BIGSERIAL NOT NULL, 
	item_id BIGINT NOT NULL, 
	document_id BIGINT NOT NULL, 
	ordinal INTEGER NOT NULL, 
	content TEXT NOT NULL, 
	heading_path TEXT DEFAULT '' NOT NULL, 
	char_start INTEGER NOT NULL, 
	token_estimate INTEGER NOT NULL, 
	embedding VECTOR, 
	embedding_model TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_chunks_document_ordinal UNIQUE (document_id, ordinal), 
	FOREIGN KEY(item_id) REFERENCES items (id) ON DELETE CASCADE, 
	FOREIGN KEY(document_id) REFERENCES documents (id) ON DELETE CASCADE
);
CREATE INDEX ix_chunks_item_id ON chunks (item_id);

ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768);
CREATE INDEX IF NOT EXISTS ix_chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
INSERT INTO schema_info (key, value) VALUES ('embedding_dim', '768'), ('schema_version', '1') ON CONFLICT DO NOTHING;
