-- Knowledge Base Database Initialization Script
-- This script runs when the PostgreSQL container is first created

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search support
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges (the database is already created by POSTGRES_DB env var)
-- Additional initialization can be added here

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Knowledge Base database initialized successfully';
END $$;
