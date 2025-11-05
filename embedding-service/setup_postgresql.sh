#!/bin/bash
# PostgreSQL 16 + pgvector Setup Script
# Run this on Vultr VM (66.42.84.126) as root

set -e  # Exit on error

echo "========================================="
echo "PostgreSQL 16 + pgvector Setup"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database credentials
DB_NAME="auditguard"
DB_USER="auditguard_user"
DB_PASSWORD="AuditGuard2025!Secure#PostgreSQL"

echo -e "${YELLOW}Step 1: Installing PostgreSQL 16...${NC}"

# Add PostgreSQL repository
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# Update and install PostgreSQL 16
apt update
apt install -y postgresql-16 postgresql-contrib-16

# Install build dependencies for pgvector
apt install -y postgresql-server-dev-16 build-essential git

echo -e "${GREEN}✅ PostgreSQL 16 installed${NC}"

echo -e "${YELLOW}Step 2: Installing pgvector extension...${NC}"

# Install pgvector
cd /tmp
git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

echo -e "${GREEN}✅ pgvector extension installed${NC}"

echo -e "${YELLOW}Step 3: Creating database and user...${NC}"

# Start PostgreSQL if not running
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE ${DB_NAME};

-- Create user
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database
\c ${DB_NAME}

-- Enable pgvector extension
CREATE EXTENSION vector;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${DB_USER};

EOF

echo -e "${GREEN}✅ Database '${DB_NAME}' and user '${DB_USER}' created${NC}"

echo -e "${YELLOW}Step 4: Configuring PostgreSQL...${NC}"

# Backup original config
cp /etc/postgresql/16/main/postgresql.conf /etc/postgresql/16/main/postgresql.conf.backup

# Update postgresql.conf
cat >> /etc/postgresql/16/main/postgresql.conf <<EOF

# ========================================
# AuditGuard Configuration
# ========================================

# Connection settings
listen_addresses = 'localhost'
max_connections = 100

# Memory settings (adjust based on VM RAM)
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 16MB
maintenance_work_mem = 128MB

# Performance tuning (SSD optimized)
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d '
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB

# Query planning
default_statistics_target = 100

EOF

# Update pg_hba.conf for local connections
cat >> /etc/postgresql/16/main/pg_hba.conf <<EOF

# AuditGuard local connections
local   ${DB_NAME}      ${DB_USER}                              scram-sha-256
host    ${DB_NAME}      ${DB_USER}      127.0.0.1/32           scram-sha-256
host    ${DB_NAME}      ${DB_USER}      ::1/128                 scram-sha-256

EOF

# Restart PostgreSQL
systemctl restart postgresql

echo -e "${GREEN}✅ PostgreSQL configured${NC}"

echo -e "${YELLOW}Step 5: Creating database schema...${NC}"

# Create schema
sudo -u postgres psql -d ${DB_NAME} <<'EOF'
-- Enable pgvector extension (redundant but safe)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- DOCUMENTS TABLE (Raw text storage)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    -- Primary identifiers
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,

    -- Raw content
    raw_text TEXT NOT NULL,

    -- File metadata
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,

    -- Storage references (cross-reference system)
    vultr_s3_key TEXT NOT NULL,
    smartbucket_key TEXT,

    -- Processing status
    processing_status TEXT DEFAULT 'pending',
    chunk_count INTEGER DEFAULT 0,
    embedding_count INTEGER DEFAULT 0,

    -- Document metrics
    word_count INTEGER,
    page_count INTEGER,

    -- User info
    uploaded_by TEXT NOT NULL,

    -- Timestamps
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    processed_at BIGINT,

    -- Constraints
    CONSTRAINT valid_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS documents_workspace_idx ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(processing_status);
CREATE INDEX IF NOT EXISTS documents_created_idx ON documents(created_at DESC);

-- Full-text search on raw text
CREATE INDEX IF NOT EXISTS documents_text_search_idx ON documents USING gin(to_tsvector('english', raw_text));

-- ============================================
-- CHUNKS TABLE (Text chunks)
-- ============================================
CREATE TABLE IF NOT EXISTS chunks (
    -- Primary identifiers
    id SERIAL PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,

    -- Chunk content
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,

    -- Chunk metadata
    token_count INTEGER NOT NULL,
    char_count INTEGER NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL,

    -- Semantic metadata
    has_header BOOLEAN DEFAULT FALSE,
    section_title TEXT,

    -- Processing status
    embedding_status TEXT DEFAULT 'pending',

    -- Timestamps
    created_at BIGINT NOT NULL,
    updated_at BIGINT,

    -- Constraints
    UNIQUE(document_id, chunk_index),
    CONSTRAINT valid_embedding_status CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for chunks
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_workspace_idx ON chunks(workspace_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_status_idx ON chunks(embedding_status);

-- Full-text search on chunk text
CREATE INDEX IF NOT EXISTS chunks_text_search_idx ON chunks USING gin(to_tsvector('english', chunk_text));

-- ============================================
-- EMBEDDINGS TABLE (Vector storage with pgvector)
-- ============================================
CREATE TABLE IF NOT EXISTS embeddings (
    -- Primary identifiers
    id TEXT PRIMARY KEY,
    chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,

    -- VECTOR COLUMN (384 dimensions for all-MiniLM-L6-v2)
    embedding vector(384) NOT NULL,

    -- Compliance tagging
    compliance_framework_id INTEGER,
    compliance_tags TEXT[],
    keywords TEXT[],

    -- Timestamps
    created_at BIGINT NOT NULL,
    updated_at BIGINT,

    -- Constraints
    UNIQUE(chunk_id)
);

-- VECTOR SIMILARITY INDEXES
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS embeddings_vector_hnsw_idx ON embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Filtering indexes
CREATE INDEX IF NOT EXISTS embeddings_document_idx ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS embeddings_workspace_idx ON embeddings(workspace_id);
CREATE INDEX IF NOT EXISTS embeddings_framework_idx ON embeddings(compliance_framework_id)
    WHERE compliance_framework_id IS NOT NULL;

-- Array indexes for tags
CREATE INDEX IF NOT EXISTS embeddings_compliance_tags_idx ON embeddings USING gin(compliance_tags);
CREATE INDEX IF NOT EXISTS embeddings_keywords_idx ON embeddings USING gin(keywords);

-- ============================================
-- WORKSPACES TABLE (Optional - for multi-tenancy)
-- ============================================
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS workspaces_created_idx ON workspaces(created_at DESC);

EOF

echo -e "${GREEN}✅ Database schema created${NC}"

echo -e "${YELLOW}Step 6: Verifying installation...${NC}"

# Verify installation
sudo -u postgres psql -d ${DB_NAME} <<EOF
-- Check pgvector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- List tables
\dt

-- Check embeddings table structure
\d embeddings

-- Verify vector index
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'embeddings';

EOF

echo -e "${GREEN}✅ Verification complete${NC}"

echo ""
echo "========================================="
echo -e "${GREEN}✅ PostgreSQL + pgvector Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Database Details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Password: ${DB_PASSWORD}"
echo ""
echo "Next Steps:"
echo "  1. Update /root/embedding-service/.env with these credentials"
echo "  2. Test connection: psql -h localhost -U ${DB_USER} -d ${DB_NAME}"
echo "  3. Continue with Phase 2: Embedding Service implementation"
echo ""
echo "========================================="
