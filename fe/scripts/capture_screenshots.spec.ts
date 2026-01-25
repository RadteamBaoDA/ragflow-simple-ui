import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Configuration
const BASE_URL = 'https://kb.baoda.live';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/assets/guidelines');
const LANGUAGES = ['en', 'vi', 'ja'];

// Role-based credentials
const USERS = {
    user: { email: 'user.developer@baoda.vn', password: 'test' },
    leader: { email: 'leader.dev@baoda.vn', password: 'test' },
    admin: { email: 'admin1@baoda.vn', password: 'test' },
};

// Feature -> Role mapping
const ROLE_FEATURES: Record<string, { featureId: string; steps: { key: string; url: string; action?: (page: any) => Promise<void> }[] }[]> = {
    user: [
        {
            featureId: 'ai-chat',
            steps: [
                { key: 'agent_selection', url: '/chat' },
                { key: 'prompt_library', url: '/chat' },
                { key: 'action_bar', url: '/chat' },
                { key: 'history_list', url: '/chat' },
                { key: 'history_search', url: '/chat/history' },
                { key: 'history_filter', url: '/chat/history' },
            ]
        },
        {
            featureId: 'ai-search',
            steps: [
                { key: 'search_query', url: '/search' },
                { key: 'result_view', url: '/search' },
                { key: 'filter', url: '/search' },
                { key: 'data_source', url: '/search' },
            ]
        },
    ],
    leader: [
        {
            featureId: 'kb-prompts',
            steps: [
                { key: 'prompt_list', url: '/knowledge-base/prompts' },
                { key: 'prompt_add', url: '/knowledge-base/prompts' },
            ]
        },
    ],
    admin: [
        {
            featureId: 'kb-config',
            steps: [
                { key: 'kb_add', url: '/knowledge-base/config' },
                { key: 'kb_permissions', url: '/knowledge-base/config' },
            ]
        },
        {
            featureId: 'iam',
            steps: [
                { key: 'user_list', url: '/iam/users' },
                { key: 'team_list', url: '/iam/teams' },
            ]
        },
        {
            featureId: 'audit',
            steps: [
                { key: 'log_list', url: '/admin/audit-log' },
                { key: 'log_search', url: '/admin/audit-log' },
            ]
        },
        {
            featureId: 'broadcast',
            steps: [
                { key: 'msg_list', url: '/admin/broadcast-messages' },
                { key: 'msg_create', url: '/admin/broadcast-messages' },
            ]
        },
        {
            featureId: 'global-histories',
            steps: [
                { key: 'sys_history_chat', url: '/admin/histories' },
                { key: 'sys_history_search', url: '/admin/histories' },
            ]
        }
    ],
};

async function login(page: any, email: string, password: string) {
    console.log(`  Logging in as ${email}...`);
    await page.goto(BASE_URL + '/login');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });

    // Try Root Login button (if exists)
    const rootBtn = page.getByRole('button', { name: /Login as Root|Root Login/i }).first();
    if (await rootBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('  Found Root Login button, clicking...');
        await rootBtn.click();

        // Wait for modal to appear
        await page.waitForTimeout(1000);

        // Wait for username input
        const inputSelector = 'input[type="text"]'; // or more specific if known
        await page.waitForSelector(inputSelector, { state: 'visible', timeout: 10000 });

        await page.fill('input[type="text"]', email);
        await page.fill('input[type="password"]', password);

        // Click submit
        await page.getByRole('button', { name: /Login/i }).last().click();
    } else {
        // Fallback: direct form
        console.log('  Root Login button not found, checking for direct form...');
        if (await page.locator('input[type="text"]').isVisible({ timeout: 5000 }).catch(() => false)) {
            await page.fill('input[type="text"]', email);
            await page.fill('input[type="password"]', password);
            await page.click('button[type="submit"]');
        } else {
            console.log('  No login form found. Checking if already logged in...');
        }
    }

    await page.waitForURL('**/*', { timeout: 20000 });
    console.log(`  Login successful or redirected.`);
}

test.describe('Role-Based Guideline Screenshots', () => {
    for (const [role, creds] of Object.entries(USERS)) {
        const features = ROLE_FEATURES[role] || [];
        if (features.length === 0) continue;

        for (const lang of LANGUAGES) {
            test(`[${role}][${lang}] Capture screenshots`, async ({ page }) => {
                test.setTimeout(180000);
                console.log(`=== [${role}][${lang}] Starting ===`);

                // Login
                await login(page, creds.email, creds.password);

                // Set language
                console.log(`  Setting language to ${lang}...`);
                await page.evaluate((l: string) => {
                    localStorage.setItem('i18nextLng', l);
                    location.reload();
                }, lang);
                await page.waitForTimeout(3000);

                // Capture each feature
                for (const feature of features) {
                    const featureDir = path.join(OUTPUT_DIR, feature.featureId);
                    if (!fs.existsSync(featureDir)) {
                        fs.mkdirSync(featureDir, { recursive: true });
                    }

                    for (const step of feature.steps) {
                        console.log(`  Capturing ${feature.featureId}/${step.key}...`);
                        try {
                            await page.goto(BASE_URL + step.url, { waitUntil: 'domcontentloaded' });
                            await page.waitForTimeout(2500);

                            if (step.action) {
                                await step.action(page);
                            }

                            const filename = `${step.key}_${lang}.png`;
                            const filepath = path.join(featureDir, filename);
                            await page.screenshot({ path: filepath, fullPage: false });
                        } catch (err: any) {
                            console.error(`  Failed: ${err.message}`);
                        }
                    }
                }

                console.log(`=== [${role}][${lang}] Done ===`);
            });
        }
    }
});
