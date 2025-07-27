
-- Initialize the tax filing database
-- This file is used by Docker to set up the initial database

-- Create database if it doesn't exist
-- (PostgreSQL in Docker will create the database specified in POSTGRES_DB)

-- Create extensions that might be useful
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance (these will be created by Prisma migrations)
-- This file serves as documentation of the database setup
