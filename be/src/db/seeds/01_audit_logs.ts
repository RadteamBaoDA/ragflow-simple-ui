/**
 * @fileoverview Seed script for audit logs test data.
 * 
 * Creates 1 million test audit log records.
 */

import { Knex } from 'knex';

const TOTAL_RECORDS = 1_000_000;
const BATCH_SIZE = 1_000;

// Sample data
const ACTIONS = [
    'login', 'logout', 'login_failed', 'create_user', 'update_user',
    'delete_user', 'update_role', 'create_bucket', 'delete_bucket',
    'upload_file', 'delete_file', 'update_config'
];

const RESOURCE_TYPES = [
    'user', 'session', 'bucket', 'file', 'config', 'system', 'role'
];

const SAMPLE_USERS = [
    { id: 'user-001', email: 'admin@baoda.vn' },
    { id: 'user-002', email: 'manager@baoda.vn' },
    { id: 'user-003', email: 'user1@baoda.vn' },
    { id: 'user-004', email: 'user2@baoda.vn' },
    { id: 'user-005', email: 'developer@baoda.vn' },
    { id: 'user-006', email: 'tester@baoda.vn' },
    { id: 'user-007', email: 'analyst@baoda.vn' },
    { id: 'user-008', email: 'support@baoda.vn' },
    { id: 'user-009', email: 'hr@baoda.vn' },
    { id: 'user-010', email: 'finance@baoda.vn' },
];

const SAMPLE_IPS = [
    '192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.50',
    '10.0.0.51', '172.16.0.10', '172.16.0.11', '203.113.152.1',
    '113.190.232.5', null
];

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomDate(): Date {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    return new Date(oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime()));
}

function generateDetails(action: string, resourceType: string): any {
    switch (action) {
        case 'login':
        case 'logout':
            return { method: randomElement(['oauth', 'dev-login', 'root']), browser: randomElement(['Chrome', 'Firefox', 'Edge']) };
        case 'login_failed':
            return { reason: randomElement(['invalid_password', 'account_locked', 'expired_token']), attempts: Math.floor(Math.random() * 5) + 1 };
        default:
            return { note: 'Test data' };
    }
}

function generateResourceId(resourceType: string): string | null {
    if (Math.random() < 0.1) return null;
    switch (resourceType) {
        case 'user': return `user-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`;
        case 'bucket': return `bucket-${Math.floor(Math.random() * 20)}`;
        default: return `res-${Math.floor(Math.random() * 1000)}`;
    }
}

export async function seed(knex: Knex): Promise<void> {
    console.log(`Starting audit log seed: ${TOTAL_RECORDS} records...`);
    const startTime = Date.now();

    // Clear existing logs? Optional. 
    // await knex('audit_logs').del();

    const allRecords: any[] = [];

    // Generating data in memory might be too heavy for 1M records at once.
    // We should loop and batch insert.

    let insertedCount = 0;
    while (insertedCount < TOTAL_RECORDS) {
        const batchSize = Math.min(BATCH_SIZE * 5, TOTAL_RECORDS - insertedCount); // Use larger memory batch
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
            const user = randomElement(SAMPLE_USERS);
            const action = randomElement(ACTIONS);
            const resourceType = randomElement(RESOURCE_TYPES);
            const details = generateDetails(action, resourceType);
            const resourceId = generateResourceId(resourceType);
            const ip = randomElement(SAMPLE_IPS);
            const createdAt = randomDate();

            batch.push({
                user_id: user.id,
                user_email: user.email,
                action,
                resource_type: resourceType,
                resource_id: resourceId,
                details: JSON.stringify(details), // Knex handles json if properly typed, but stringify is safe
                ip_address: ip,
                created_at: createdAt
            });
        }

        await knex.batchInsert('audit_logs', batch, BATCH_SIZE);
        insertedCount += batchSize;
        process.stdout.write(`\rInserted ${insertedCount}/${TOTAL_RECORDS} audit logs...`);
    }

    console.log(`\nAudit log seed completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}
