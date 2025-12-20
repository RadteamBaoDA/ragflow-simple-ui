/**
 * Migration 008: IAM Enhancement
 * 
 * Adds tables for Team Management:
 * - teams: stores team details
 * - user_teams: many-to-many relationship between users and teams
 */

import { Migration } from './types.js';
import { DatabaseAdapter } from '../types.js';
import { log } from '../../services/logger.service.js';

export const migration: Migration = {
    name: '008_iam_enhancement',

    async up(db: DatabaseAdapter): Promise<void> {
        log.info('Running migration: 008_iam_enhancement');

        // Create teams table
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

        // Create user_teams junction table
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

        // Create indexes for performance
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id)');
    },

    async down(db: DatabaseAdapter): Promise<void> {
        log.info('Reverting migration: 008_iam_enhancement');
        await db.query('DROP TABLE IF EXISTS user_teams');
        await db.query('DROP TABLE IF EXISTS teams');
    }
};

