/**
 * @fileoverview Seed script for prompts data.
 *
 * Generates 20 mock tags and 1000 mock prompts.
 * Matches current schema: prompt_tags (uuid id, name, color, created_by, updated_by)
 * and prompts (uuid id, prompt, description, tags jsonb, source, is_active, created_by, updated_by).
 */

import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'

const TOTAL_PROMPTS = 1000
const BATCH_SIZE = 100

// Predefined tags with colors
const TAGS = [
    { name: 'Coding', color: '#108ee9' },
    { name: 'Writing', color: '#87d068' },
    { name: 'Business', color: '#2db7f5' },
    { name: 'Fun', color: '#f50' },
    { name: 'Support', color: '#f50' },
    { name: 'Marketing', color: '#722ed1' },
    { name: 'Sales', color: '#fa8c16' },
    { name: 'HR', color: '#eb2f96' },
    { name: 'Legal', color: '#52c41a' },
    { name: 'Finance', color: '#13c2c2' },
    { name: 'Education', color: '#2f54eb' },
    { name: 'Health', color: '#a0d911' },
    { name: 'Science', color: '#fadb14' },
    { name: 'Technology', color: '#fa541c' },
    { name: 'Art', color: '#722ed1' },
    { name: 'Music', color: '#eb2f96' },
    { name: 'Travel', color: '#1890ff' },
    { name: 'Food', color: '#52c41a' },
    { name: 'Sports', color: '#fa8c16' },
    { name: 'News', color: '#f5222d' }
]

const PROMPT_TEMPLATES = [
    'Write a blog post about {topic}',
    'Explain {topic} to a 5 year old',
    'Create a marketing plan for {topic}',
    'Debug this {topic} code',
    'Translate {topic} to Spanish',
    'Summarize the key points of {topic}',
    'Generate ideas for {topic}',
    'Write a poem about {topic}',
    'Analyze the trends in {topic}',
    'Suggest improvements for {topic}'
]

const TOPICS = [
    'Artificial Intelligence', 'Blockchain', 'Climate Change', 'Remote Work',
    'Cybersecurity', 'E-commerce', 'Social Media', 'Mental Health',
    'Renewable Energy', 'Space Exploration', 'Quantum Computing', 'Genomics',
    'Virtual Reality', 'Augmented Reality', 'IoT', '5G', 'Cloud Computing',
    'Big Data', 'Machine Learning', 'Deep Learning'
]

/**
 * Pick a random element from an array.
 * @param arr - Source array
 * @returns Random element
 */
function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!
}

/**
 * Get random tag names for a prompt.
 * @param count - Number of tags to pick
 * @returns Array of tag names
 */
function getRandomTags(count: number): string[] {
    const shuffled = [...TAGS].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count).map(t => t.name)
}

/**
 * Seed function for prompts: tags and prompt records.
 *
 * @param knex - Knex instance for database operations
 * @returns Promise<void>
 */
export async function seed(knex: Knex): Promise<void> {
    console.log('Starting prompts seed...')
    const startTime = Date.now()

    try {
        // ========================================
        // 1. Insert Tags
        // ========================================
        console.log('Seeding tags...')
        for (const tag of TAGS) {
            await knex('prompt_tags')
                .insert({
                    id: uuidv4(),
                    name: tag.name,
                    color: tag.color,
                })
                .onConflict('name')
                .ignore()
        }

        // ========================================
        // 2. Generate Prompts
        // ========================================
        console.log(`Generating ${TOTAL_PROMPTS} prompts...`)
        const promptsBatch: any[] = []

        for (let i = 0; i < TOTAL_PROMPTS; i++) {
            const template = randomElement(PROMPT_TEMPLATES)
            const topic = randomElement(TOPICS)
            const promptText = template.replace('{topic}', topic) + ` (${i})`

            // Assign 0-3 random tags
            const numTags = Math.floor(Math.random() * 4)
            const tags = getRandomTags(numTags)

            promptsBatch.push({
                id: uuidv4(),
                prompt: promptText,
                description: `Automatically generated prompt about ${topic}`,
                tags: JSON.stringify(tags),
                source: 'chat',
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            })
        }

        await knex.batchInsert('prompts', promptsBatch, BATCH_SIZE)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`Prompts seed completed in ${elapsed}s`)
        console.log(`  - Tags: ${TAGS.length}, Prompts: ${promptsBatch.length}`)
    } catch (error) {
        console.error('Error in prompts seed:', error)
        throw error
    }
}
