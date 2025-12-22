
import { query } from './be/src/db/index';
import { log } from './be/src/services/logger.service';

async function checkSchema() {
    try {
        const result = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ragflow_sources';
        `);
        console.log('Columns in ragflow_sources:', result);
    } catch (error) {
        console.error('Error checking schema:', error);
    }
    process.exit(0);
}

checkSchema();
