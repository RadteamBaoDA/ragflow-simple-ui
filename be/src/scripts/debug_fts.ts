import { db } from '@/shared/db/knex.js';

async function debugFts() {
    console.log('Debugging FTS...');
    try {
        // 1. Check a record that contains "reranker" in search_input or ai_summary
        const record = await db('external_search_history')
            .where('search_input', 'ilike', '%rerank%')
            .orWhere('ai_summary', 'ilike', '%rerank%')
            .first();

        if (!record) {
            console.log('No record found with "rerank" in text fields.');
            return;
        }

        console.log('Found Record ID:', record.id);
        console.log('Search Input:', record.search_input);
        console.log('AI Summary:', record.ai_summary);
        console.log('Search Vector:', record.search_vector);

        // 2. Test exact query match
        const queryTerm = 'reranker';

        // Check what the query converts to
        const tsQuery = await db.raw("SELECT websearch_to_tsquery('english', ?) as q", [queryTerm]);
        console.log(`websearch_to_tsquery('${queryTerm}'):`, tsQuery.rows[0].q);

        // Check if it matches via SQL
        const match = await db('external_search_history')
            .whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [queryTerm])
            .andWhere('id', record.id)
            .count('* as count');

        console.log('Match count for FTS query:', match[0]?.count ?? 0);

        // 4. Test specific user scenario "what is reranker"
        console.log('\n--- Scenario: "what is reranker" ---');
        // Use a valid UUID to avoid 22P02 error
        const simulatedId = '550e8400-e29b-41d4-a716-446655440000';
        // Cleanup potential previous run
        await db('external_chat_history').where('id', simulatedId).del();

        await db('external_chat_history').insert({
            id: simulatedId,
            session_id: 'session-123',
            user_email: 'test@test.com',
            user_prompt: 'what is reranker',
            llm_response: 'Rerankers are useful.',
            citations: JSON.stringify([]),
        });

        const simRecord = await db('external_chat_history').where('id', simulatedId).first();
        console.log('Simulated Record Vector:', simRecord.search_vector);

        const terms = ['reranker', 'what is reranker', 'rerank', 'reran'];
        for (const t of terms) {
            const m = await db('external_chat_history')
                .whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [t])
                .andWhere('id', simulatedId)
                .count('* as count');
            console.log(`Query '${t}' match count:`, m[0]?.count ?? 0);
        }

        // Cleanup
        await db('external_chat_history').where('id', simulatedId).del();

    } catch (err) {
        console.error(err);
    } finally {
        await db.destroy();
    }
}

debugFts();
