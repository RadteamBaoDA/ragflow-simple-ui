
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { minioService } from '../services/minio.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testMinioService() {
    console.log('--- MinIO Service Test ---');

    const bucketName = 'test-service-bucket-' + Date.now();
    const objectName = 'test-file.txt';
    const content = Buffer.from('Hello MinIO Service!');

    try {
        // 1. Create Bucket
        console.log(`\n1. Creating Bucket: ${bucketName}...`);
        await minioService.createBucket(bucketName);
        console.log('Success.');

        // 2. Upload File
        console.log(`\n2. Uploading File: ${objectName}...`);
        await minioService.uploadFile(bucketName, objectName, content, content.length, {
            'Content-Type': 'text/plain',
        });
        console.log('Success.');

        // 3. List Objects
        console.log('\n3. Listing Objects...');
        const objects = await minioService.listObjects(bucketName, '', true);
        console.log(`Found ${objects.length} objects.`);
        objects.forEach(o => console.log(` - ${o.name} (${o.size} bytes)`));

        // 4. Get Download URL
        console.log('\n4. Generating Download URL...');
        const url = await minioService.getDownloadUrl(bucketName, objectName);
        console.log(`URL: ${url}`);

        // 5. Delete Object
        console.log('\n5. Deleting Object...');
        await minioService.deleteObject(bucketName, objectName);
        console.log('Success.');

        // 6. Delete Bucket
        console.log('\n6. Deleting Bucket...');
        await minioService.deleteBucket(bucketName);
        console.log('Success.');

        console.log('\n--- Test Completed Successfully ---');

    } catch (error: any) {
        console.error('\n--- Test Failed ---');
        console.error('Error:', error.message);
        if (error.stack) console.error('Stack:', error.stack);
    }
}

testMinioService();
