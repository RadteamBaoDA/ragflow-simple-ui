/**
 * @fileoverview Seed script for sample users with different roles.
 * 
 * Creates sample users for each role (admin, leader, user) as a guideline
 * for understanding the role-based access control system.
 * 
 * @description
 * This seed creates the following users:
 * - Admin role: Full system access, can manage all resources
 * - Leader role: Team management access, can manage team members
 * - User role: Basic access, can view and use assigned resources
 * 
 * @example
 * Run seed: npx knex seed:run --specific=00_sample_users.ts
 */

import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'

/**
 * Sample users configuration for different roles.
 * Each entry represents a user with specific role and permissions.
 */
const SAMPLE_USERS = [
    // ========================
    // ADMIN ROLE USERS
    // ========================
    {
        id: uuidv4(),
        email: 'admin1@baoda.vn',
        display_name: 'System Administrator',
        role: 'admin',
        permissions: JSON.stringify(['*']), // Full access
        department: 'IT Department',
        job_title: 'System Administrator',
        mobile_phone: '+84-123-456-789'
    },
    {
        id: uuidv4(),
        email: 'super.admin@baoda.vn',
        display_name: 'Super Admin',
        role: 'admin',
        permissions: JSON.stringify(['*']), // Full access
        department: 'Management',
        job_title: 'Chief Technology Officer',
        mobile_phone: '+84-987-654-321'
    },

    // ========================
    // LEADER ROLE USERS
    // ========================
    {
        id: uuidv4(),
        email: 'leader.dev@baoda.vn',
        display_name: 'Development Team Leader',
        role: 'leader',
        permissions: JSON.stringify([
            'team:manage',
            'team:view',
            'user:view',
            'bucket:view',
            'bucket:upload',
            'knowledge_base:manage',
            'chat:manage'
        ]),
        department: 'Development',
        job_title: 'Team Lead',
        mobile_phone: '+84-111-222-333'
    },
    {
        id: uuidv4(),
        email: 'leader.qa@baoda.vn',
        display_name: 'QA Team Leader',
        role: 'leader',
        permissions: JSON.stringify([
            'team:manage',
            'team:view',
            'user:view',
            'bucket:view',
            'knowledge_base:view',
            'chat:view'
        ]),
        department: 'Quality Assurance',
        job_title: 'QA Lead',
        mobile_phone: '+84-222-333-444'
    },
    {
        id: uuidv4(),
        email: 'leader.design@baoda.vn',
        display_name: 'Design Team Leader',
        role: 'leader',
        permissions: JSON.stringify([
            'team:manage',
            'team:view',
            'user:view',
            'bucket:view',
            'bucket:upload'
        ]),
        department: 'Design',
        job_title: 'Design Lead',
        mobile_phone: '+84-333-444-555'
    },

    // ========================
    // USER ROLE USERS
    // ========================
    {
        id: uuidv4(),
        email: 'user.developer@baoda.vn',
        display_name: 'Developer User',
        role: 'user',
        permissions: JSON.stringify([
            'bucket:view',
            'knowledge_base:view',
            'chat:view'
        ]),
        department: 'Development',
        job_title: 'Software Developer',
        mobile_phone: '+84-444-555-666'
    },
    {
        id: uuidv4(),
        email: 'user.tester@baoda.vn',
        display_name: 'Tester User',
        role: 'user',
        permissions: JSON.stringify([
            'bucket:view',
            'knowledge_base:view'
        ]),
        department: 'Quality Assurance',
        job_title: 'QA Engineer',
        mobile_phone: '+84-555-666-777'
    },
    {
        id: uuidv4(),
        email: 'user.designer@baoda.vn',
        display_name: 'Designer User',
        role: 'user',
        permissions: JSON.stringify([
            'bucket:view'
        ]),
        department: 'Design',
        job_title: 'UI/UX Designer',
        mobile_phone: '+84-666-777-888'
    },
    {
        id: uuidv4(),
        email: 'user.analyst@baoda.vn',
        display_name: 'Business Analyst',
        role: 'user',
        permissions: JSON.stringify([
            'bucket:view',
            'knowledge_base:view',
            'chat:view'
        ]),
        department: 'Business Analysis',
        job_title: 'Business Analyst',
        mobile_phone: '+84-777-888-999'
    }
]

/**
 * Seed function to insert sample users into the database.
 * 
 * @param knex - Knex instance for database operations
 * @returns Promise<void> - Resolves when seeding is complete
 * 
 * @description
 * This function performs the following operations:
 * 1. Logs the start of the seeding process
 * 2. Checks for existing users to avoid duplicates
 * 3. Inserts new users with upsert (on conflict do nothing)
 * 4. Logs the completion status
 */
export async function seed(knex: Knex): Promise<void> {
    console.log('Starting sample users seed...')
    console.log('='.repeat(50))

    const startTime = Date.now()
    let insertedCount = 0
    let skippedCount = 0

    // Process each user individually to handle conflicts gracefully
    for (const user of SAMPLE_USERS) {
        // Check if user with same email already exists
        const existing = await knex('users')
            .where({ email: user.email })
            .first()

        if (existing) {
            // User already exists, skip insertion
            console.log(`[SKIP] User already exists: ${user.email} (${user.role})`)
            skippedCount++
        } else {
            // Insert new user with timestamps
            await knex('users').insert({
                ...user,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now()
            })
            console.log(`[INSERT] Created user: ${user.email} (${user.role})`)
            insertedCount++
        }
    }

    // Calculate elapsed time
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    // Log summary
    console.log('='.repeat(50))
    console.log(`Sample users seed completed in ${elapsed}s`)
    console.log(`  - Inserted: ${insertedCount}`)
    console.log(`  - Skipped:  ${skippedCount}`)
    console.log(`  - Total:    ${SAMPLE_USERS.length}`)
    console.log('')
    console.log('User Roles Guide:')
    console.log('  - ADMIN:  Full system access, can manage all resources')
    console.log('  - LEADER: Team management, can manage team members and resources')
    console.log('  - USER:   Basic access, can view and use assigned resources')
}
