/**
 * @fileoverview Seed script for audit logs test data.
 * 
 * Creates 1 million test audit log records for testing:
 * - Pagination performance
 * - Filter functionality
 * - Search performance
 * 
 * Usage: npx tsx src/scripts/seed-audit-logs.ts
 * 
 * @module scripts/seed-audit-logs
 */

import { getAdapter } from '../db/index.js';
import { log } from '../services/logger.service.js';

// ============================================================================
// Test Data Configuration
// ============================================================================

const TOTAL_RECORDS = 1_000_000;
const BATCH_SIZE = 1_000; // Insert in batches for performance (PostgreSQL has ~32K param limit)

// Sample data for random selection
const ACTIONS = [
    'login',
    'logout',
    'login_failed',
    'create_user',
    'update_user',
    'delete_user',
    'update_role',
    'create_bucket',
    'delete_bucket',
    'upload_file',
    'delete_file',
    'update_config',
];

const RESOURCE_TYPES = [
    'user',
    'session',
    'bucket',
    'file',
    'config',
    'system',
    'role',
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
    '192.168.1.100',
    '192.168.1.101',
    '192.168.1.102',
    '10.0.0.50',
    '10.0.0.51',
    '172.16.0.10',
    '172.16.0.11',
    '203.113.152.1',
    '113.190.232.5',
    null, // Some records without IP
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get random element from array.
 */
function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Generate random date within the past year.
 */
function randomDate(): Date {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    return new Date(oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime()));
}

/**
 * Generate random details based on action type.
 */
function generateDetails(action: string, resourceType: string): Record<string, any> {
    switch (action) {
        case 'login':
        case 'logout':
            return { method: randomElement(['oauth', 'dev-login', 'root']), browser: randomElement(['Chrome', 'Firefox', 'Edge']) };
        case 'login_failed':
            return { reason: randomElement(['invalid_password', 'account_locked', 'expired_token']), attempts: Math.floor(Math.random() * 5) + 1 };
        case 'update_role':
            return { oldRole: randomElement(['user', 'manager']), newRole: randomElement(['manager', 'admin']) };
        case 'create_user':
        case 'update_user':
        case 'delete_user':
            return { targetUser: `user-${Math.floor(Math.random() * 100)}@baoda.vn` };
        case 'create_bucket':
        case 'delete_bucket':
            return { bucketName: `bucket-${Math.floor(Math.random() * 20)}`, region: 'ap-southeast-1' };
        case 'upload_file':
        case 'delete_file':
            return { 
                fileName: `document-${Math.floor(Math.random() * 1000)}.${randomElement(['pdf', 'docx', 'xlsx', 'png'])}`,
                fileSize: Math.floor(Math.random() * 10000000),
                bucket: `bucket-${Math.floor(Math.random() * 5)}`
            };
        case 'update_config':
            return { configKey: randomElement(['theme', 'language', 'notifications', 'security']), oldValue: 'old', newValue: 'new' };
        default:
            return { note: 'Test data' };
    }
}

/**
 * Generate resource ID based on resource type.
 */
function generateResourceId(resourceType: string): string | null {
    if (Math.random() < 0.1) return null; // 10% chance of null
    
    switch (resourceType) {
        case 'user':
            return `user-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`;
        case 'session':
            return `sess-${Math.random().toString(36).substring(2, 10)}`;
        case 'bucket':
            return `bucket-${Math.floor(Math.random() * 20)}`;
        case 'file':
            return `file-${Math.random().toString(36).substring(2, 12)}`;
        case 'config':
            return randomElement(['system', 'ragflow', 'minio', 'auth']);
        default:
            return null;
    }
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seedAuditLogs() {
    log.debug('Starting audit log seed script...', { totalRecords: TOTAL_RECORDS, batchSize: BATCH_SIZE });
    
    const db = await getAdapter();
    const startTime = Date.now();
    
    let insertedCount = 0;
    const totalBatches = Math.ceil(TOTAL_RECORDS / BATCH_SIZE);
    
    for (let batch = 0; batch < totalBatches; batch++) {
        const batchStart = Date.now();
        const recordsInBatch = Math.min(BATCH_SIZE, TOTAL_RECORDS - insertedCount);
        
        // Build bulk insert values
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;
        
        for (let i = 0; i < recordsInBatch; i++) {
            const user = randomElement(SAMPLE_USERS);
            const action = randomElement(ACTIONS);
            const resourceType = randomElement(RESOURCE_TYPES);
            const details = generateDetails(action, resourceType);
            const resourceId = generateResourceId(resourceType);
            const ip = randomElement(SAMPLE_IPS);
            const createdAt = randomDate();
            
            placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`);
            values.push(
                user.id,
                user.email,
                action,
                resourceType,
                resourceId,
                JSON.stringify(details),
                ip,
                createdAt.toISOString()
            );
            paramIndex += 8;
        }
        
        // Execute bulk insert
        const sql = `
            INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, details, ip_address, created_at)
            VALUES ${placeholders.join(', ')}
        `;
        
        await db.query(sql, values);
        
        insertedCount += recordsInBatch;
        const batchTime = Date.now() - batchStart;
        const progress = ((insertedCount / TOTAL_RECORDS) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (insertedCount / parseFloat(elapsed)).toFixed(0);
        
        log.debug(`Batch ${batch + 1}/${totalBatches} completed`, {
            inserted: insertedCount,
            progress: `${progress}%`,
            batchTime: `${batchTime}ms`,
            elapsed: `${elapsed}s`,
            rate: `${rate} records/s`
        });
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log.debug('Audit log seed completed!', { 
        totalRecords: insertedCount, 
        totalTime: `${totalTime}s`,
        averageRate: `${(insertedCount / parseFloat(totalTime)).toFixed(0)} records/s`
    });
    
    // Verify count
    const result = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM audit_logs');
    log.debug('Total audit logs in database:', { count: result[0]?.count });
    
    process.exit(0);
}

// Run the seed script
seedAuditLogs().catch((error) => {
    log.error('Seed script failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
});
