
import dotenv from 'dotenv';
import * as Minio from 'minio';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testMinio() {
    console.log('--- MinIO Connection Test ---');

    const config = {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || '',
        secretKey: process.env.MINIO_SECRET_KEY || '',
    };

    console.log('Configuration:', {
        ...config,
        accessKey: config.accessKey ? '***' : 'MISSING',
        secretKey: config.secretKey ? '***' : 'MISSING',
    });

    if (!config.accessKey || !config.secretKey) {
        console.error('ERROR: MinIO credentials missing in .env');
        return;
    }

    const minioClient = new Minio.Client(config);
    const bucketName = 'test-bucket-' + Date.now();

    try {
        // 1. List Buckets
        console.log('\n1. Listing Buckets...');
        const buckets = await minioClient.listBuckets();
        console.log(`Success: Found ${buckets.length} buckets.`);
        buckets.forEach(b => console.log(` - ${b.name}`));

        // 2. Create Test Bucket
        console.log(`\n2. Creating Test Bucket: ${bucketName}...`);
        await minioClient.makeBucket(bucketName, 'us-east-1');
        console.log('Success: Bucket created.');

        // 3. Upload File
        console.log('\n3. Uploading Test File...');
        const objectName = 'test-file.txt';
        const content = 'Hello MinIO!';
        await minioClient.putObject(bucketName, objectName, Buffer.from(content), content.length);
        console.log('Success: File uploaded.');

        // 4. Generate Download URL
        console.log('\n4. Generating Download URL...');
        const url = await minioClient.presignedGetObject(bucketName, objectName, 3600);
        console.log(`Success: URL generated: ${url}`);

        // 5. Delete File
        console.log('\n5. Deleting Test File...');
        await minioClient.removeObject(bucketName, objectName);
        console.log('Success: File deleted.');

        // 6. Delete Bucket
        console.log('\n6. Deleting Test Bucket...');
        await minioClient.removeBucket(bucketName);
        console.log('Success: Bucket deleted.');

        console.log('\n--- Test Completed Successfully ---');

    } catch (error: any) {
        console.error('\n--- Test Failed ---');
        console.error('Error:', error.message);
        if (error.code) console.error('Code:', error.code);
        if (error.command) console.error('Command:', error.command);
        console.error('Stack:', error.stack);
    }
}

testMinio();
