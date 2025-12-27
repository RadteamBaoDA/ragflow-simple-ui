
import { getAdapter } from '../db/index.js';
import { log } from '../services/logger.service.js';

async function verifyMockData() {
    const db = await getAdapter();

    const userCount = await db.queryOne<{ count: string }>("SELECT count(*) as count FROM users WHERE email LIKE 'mock_user_%'");
    const chatCount = await db.queryOne<{ count: string }>("SELECT count(*) as count FROM external_chat_history");
    const searchCount = await db.queryOne<{ count: string }>("SELECT count(*) as count FROM external_search_history");

    log.info('Verification results:', {
        users: userCount?.count,
        chatHistory: chatCount?.count,
        searchHistory: searchCount?.count
    });

    process.exit(0);
}

verifyMockData().catch(e => {
    console.error(e);
    process.exit(1);
});
