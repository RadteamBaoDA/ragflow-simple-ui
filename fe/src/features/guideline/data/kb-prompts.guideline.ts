import { IFeatureGuideline } from './types';

export const kbPromptsGuideline: IFeatureGuideline = {
    featureId: 'kb-prompts',
    roleRequired: 'leader',
    overview: {
        en: 'Manage the organizational Prompt Library. Create standard prompts for your team to ensure consistent AI outputs.',
        vi: 'Quản lý Thư viện Gợi ý của tổ chức. Tạo các gợi ý tiêu chuẩn cho nhóm của bạn để đảm bảo kết quả AI nhất quán.',
        ja: '組織のプロンプトライブラリを管理します。チーム向けに標準プロンプトを作成し、一貫したAI出力を確保します。'
    },
    tabs: [
        {
            tabId: 'management',
            tabTitle: { en: 'Prompt Management', vi: 'Quản Lý Gợi Ý', ja: 'プロンプト管理' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Create Prompt', vi: 'Tạo Gợi Ý', ja: 'プロンプト作成' },
                    description: {
                        en: 'Design new prompts with variables and instructions.',
                        vi: 'Thiết kế các gợi ý mới với các biến và hướng dẫn.',
                        ja: '変数と指示を含む新しいプロンプトを設計します。'
                    },
                    details: {
                        en: [
                            '1. Click "+ New Prompt" to open the editor.',
                            '2. Give your prompt a clear title and description.',
                            '3. Write the prompt content, using {{variable}} for dynamic inputs.'
                        ],
                        vi: [
                            '1. Nhấp vào "+ Gợi ý mới" để mở trình chỉnh sửa.',
                            '2. Đặt tiêu đề và mô tả rõ ràng cho gợi ý của bạn.',
                            '3. Viết nội dung gợi ý, sử dụng {{biến}} cho các đầu vào động.'
                        ],
                        ja: [
                            '1. 「+ 新規プロンプト」をクリックしてエディタを開きます。',
                            '2. プロンプトに明確なタイトルと説明を付けます。',
                            '3. 動的な入力には{{variable}}を使用して、プロンプトの内容を作成します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Organize Library', vi: 'Tổ Chức Thư Viện', ja: 'ライブラリ整理' },
                    description: {
                        en: 'Categorize prompts for easy access by users.',
                        vi: 'Phân loại các gợi ý để người dùng dễ dàng truy cập.',
                        ja: 'ユーザーが簡単にアクセスできるようにプロンプトを分類します。'
                    },
                    details: {
                        en: [
                            '1. Assign tags or categories to each prompt.',
                            '2. Use the search bar to find and edit existing prompts.',
                            '3. Pin important prompts to the top of the library.'
                        ],
                        vi: [
                            '1. Gán thẻ hoặc danh mục cho mỗi gợi ý.',
                            '2. Sử dụng thanh tìm kiếm để tìm và chỉnh sửa các gợi ý hiện có.',
                            '3. Ghim các gợi ý quan trọng lên đầu thư viện.'
                        ],
                        ja: [
                            '1. 各プロンプトにタグまたはカテゴリを割り当てます。',
                            '2. 検索バーを使用して、既存のプロンプトを検索して編集します。',
                            '3. 重要なプロンプトをライブラリの上部に固定します。'
                        ]
                    }
                }
            ]
        }
    ]
};
