/**
 * @fileoverview Initial schema migration.
 * 
 * Consolidated migration that creates the full database schema:
 * - users (with profile fields, RBAC)
 * - teams & user_teams (IAM)
 * - chat_sessions & chat_messages
 * - ragflow_sources (with access_control)
 * - system_configs
 * - minio_buckets
 * - document_permissions (formerly storage_permissions)
 * - audit_logs
 * - user_ip_history
 * 
 * @module db/migrations/001_initial_schema
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '001_initial_schema',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 001_initial_schema');

        // 1. Users
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                permissions TEXT NOT NULL DEFAULT '[]',
                department TEXT,
                job_title TEXT,
                mobile_phone TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // 2. Teams
        await db.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                project_name TEXT,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // 3. User Teams Junction
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_teams (
                user_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                PRIMARY KEY (user_id, team_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id)');

        // 4. Chat Sessions
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 5. Chat Messages
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            )
        `);

        // 6. MinIO Buckets
        await db.query(`
            CREATE TABLE IF NOT EXISTS minio_buckets (
                id TEXT PRIMARY KEY,
                bucket_name TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                description TEXT,
                created_by TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);

        // 7. System Configs
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_configs (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // 8. Knowledge Base Sources
        await db.query(`
            CREATE TABLE IF NOT EXISTS knowledge_base_sources (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                access_control JSONB DEFAULT '{"public": true}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // 9. Audit Logs
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                user_email TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT,
                details JSONB DEFAULT '{}',
                ip_address TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_user ON audit_logs(created_at DESC, user_id)');

        // 10. User IP History
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_ip_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, ip_address),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_ip_history_user_id ON user_ip_history(user_id)');

        // 11. Document Permissions (formerly storage_permissions)
        // Includes bucket_id from the start (merged from 002_bucket_permissions)
        await db.query(`
            CREATE TABLE IF NOT EXISTS document_permissions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('user', 'team')),
                entity_id TEXT NOT NULL,
                bucket_id TEXT NOT NULL,
                permission_level INT NOT NULL DEFAULT 0 CHECK (permission_level BETWEEN 0 AND 3),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(entity_type, entity_id, bucket_id),
                FOREIGN KEY (bucket_id) REFERENCES minio_buckets(id) ON DELETE CASCADE
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_document_permissions_entity ON document_permissions(entity_type, entity_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_document_permissions_bucket ON document_permissions(bucket_id)');

        log.info('Final schema created successfully');
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 001_initial_schema');

        await db.query('DROP TABLE IF EXISTS document_permissions');
        await db.query('DROP TABLE IF EXISTS user_ip_history');
        await db.query('DROP TABLE IF EXISTS audit_logs');
        await db.query('DROP TABLE IF EXISTS knowledge_base_sources');
        await db.query('DROP TABLE IF EXISTS system_configs');
        await db.query('DROP TABLE IF EXISTS minio_buckets');
        await db.query('DROP TABLE IF EXISTS chat_messages');
        await db.query('DROP TABLE IF EXISTS chat_sessions');
        await db.query('DROP TABLE IF EXISTS user_teams');
        await db.query('DROP TABLE IF EXISTS teams');
        await db.query('DROP TABLE IF EXISTS users');
    }
};
