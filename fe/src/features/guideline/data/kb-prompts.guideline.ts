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
            tabId: 'add_prompt',
            tabTitle: { en: 'Add Prompt', vi: 'Thêm Gợi Ý', ja: '新しいプロンプト' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Add New Prompt', vi: 'Thêm Gợi Ý Mới', ja: '新しいプロンプトを追加' },
                    description: {
                        en: 'Define new prompts with details and tags.',
                        vi: 'Xác định các gợi ý mới với chi tiết và thẻ.',
                        ja: '詳細とタグを含む新しいプロンプトを定義します。'
                    },
                    details: {
                        en: [
                            '1. Enter the prompt text in the main text area.',
                            '2. Add a description to explain the prompt\'s purpose.',
                            '3. **Tags**: Select existing tags or type to create new ones (supports multiple tags).'
                        ],
                        vi: [
                            '1. Nhập nội dung gợi ý vào khu vực văn bản chính.',
                            '2. Thêm mô tả để giải thích mục đích của gợi ý.',
                            '3. **Thẻ**: Chọn các thẻ có sẵn hoặc nhập để tạo thẻ mới (hỗ trợ nhiều thẻ).'
                        ],
                        ja: [
                            '1. メインテキストエリアにプロンプトテキストを入力します。',
                            '2. プロンプトの目的を説明する説明を追加します。',
                            '3. **タグ**: 既存のタグを選択するか、入力して新しいタグを作成します（複数のタグをサポート）。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'bulk_import',
            tabTitle: { en: 'CSV Import', vi: 'Nhập CSV', ja: 'CSVインポート' },
            steps: [
                {
                    id: 'step_csv1',
                    title: { en: 'Prepare Your CSV (Excel Tips)', vi: 'Chuẩn bị CSV (Mẹo Excel)', ja: 'CSVの準備（Excelのヒント）' },
                    description: {
                        en: 'Follow these tips to avoid common errors when using Excel or Google Sheets.',
                        vi: 'Làm theo các mẹo sau để tránh các lỗi phổ biến khi sử dụng Excel hoặc Google Sheets.',
                        ja: 'ExcelやGoogleスプレッドシートを使用する際の一般的なエラーを避けるために、以下のヒントに従ってください。'
                    },
                    details: {
                        en: [
                            '1. **Excel Multi-line**: Press **Alt + Enter** inside a cell to start a new line. Excel will handle the "quotes" for you automatically.',
                            '2. **Markdown**: High-level headers (#), bold (**), and lists (-) are fully supported.',
                            '3. **Required Header**: Your first row MUST be: `prompt, description, tags, source`.',
                            '4. **Encoding**: When saving from Excel, choose **CSV UTF-8 (Comma delimited)** to prevent Japanese/Vietnamese characters from breaking.',
                            '5. **Limit**: Maximum 1000 rows and 5MB per file.'
                        ],
                        vi: [
                            '1. **Excel Nhiều dòng**: Nhấn **Alt + Enter** bên trong ô để bắt đầu dòng mới. Excel sẽ tự động xử lý dấu "ngoặc kép" cho bạn.',
                            '2. **Markdown**: Các tiêu đề (#), chữ đậm (**) và danh sách (-) được hỗ trợ đầy đủ.',
                            '3. **Tiêu đề bắt buộc**: Dòng đầu tiên PHẢI là: `prompt, description, tags, source`.',
                            '4. **Mã hóa**: Khi lưu từ Excel, hãy chọn **CSV UTF-8 (Comma delimited)** để tránh lỗi font chữ tiếng Việt.',
                            '5. **Giới hạn**: Tối đa 1000 dòng và 5MB mỗi tệp.'
                        ],
                        ja: [
                            '1. **Excelの改行**: セル内で **Alt + Enter** を押すと新しい行が始まります。Excelが自動的に「引用符」を処理します。',
                            '2. **Markdown**: 見出し（#）、太字（**）、リスト（-）が完全にサポートされています。',
                            '3. **必須ヘッダー**: 1行目は必ず `prompt, description, tags, source` にしてください。',
                            '4. **エンコーディング**: Excelで保存する際は、日本語が文字化けしないよう **CSV UTF-8 (コンマ区切り)** を選択してください。',
                            '5. **制限**: 1ファイルあたり最大1000行、5MBまで。'
                        ]
                    }
                },
                {
                    id: 'step_csv2',
                    title: { en: 'Import Process', vi: 'Quy Trình Nhập', ja: 'インポート手順' },
                    description: {
                        en: 'Upload and review your CSV before importing.',
                        vi: 'Tải lên và xem lại CSV trước khi nhập.',
                        ja: 'インポート前にCSVをアップロードして確認します。'
                    },
                    details: {
                        en: [
                            '1. Click **Import CSV** in the prompt library.',
                            '2. Use **Download Template** to get the correct format.',
                            '3. Drag and drop your file. **Green rows** are ready to import, **Red rows** have errors.',
                            '4. Click **Import**. The system will automatically skip prompts that already exist.'
                        ],
                        vi: [
                            '1. Nhấp vào **Nhập CSV** trong thư viện prompt.',
                            '2. Sử dụng **Tải Template** để có định dạng chính xác.',
                            '3. Kéo và thả tệp của bạn. **Dòng xanh** đã sẵn sàng, **Dòng đỏ** có lỗi cần sửa.',
                            '4. Nhấp **Nhập**. Hệ thống sẽ tự động bỏ qua các prompt đã tồn tại.'
                        ],
                        ja: [
                            '1. プロンプトライブラリで **CSVインポート** をクリックします。',
                            '2. **テンプレートをダウンロード** して正しい形式を確認してください。',
                            '3. ファイルをドラッグ＆ドロップします。**緑色の行**はインポート可能、**赤色の行**はエラーです。',
                            '4. **インポート** をクリックします。既存のプロンプトは自動的にスキップされます。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'permissions',
            tabTitle: { en: 'Permissions', vi: 'Quyền Truy Cập', ja: '権限' },
            steps: [
                {
                    id: 'step2',
                    title: { en: 'Manage Permissions', vi: 'Quản Lý Quyền', ja: '権限管理' },
                    description: {
                        en: 'Control who can access and use this prompt.',
                        vi: 'Kiểm soát ai có thể truy cập và sử dụng gợi ý này.',
                        ja: 'このプロンプトにアクセスして使用できるユーザーを制御します。'
                    },
                    details: {
                        en: [
                            '1. **Leader Permissions**: Note that permissions cascade to team leaders.',
                            '2. **Select User/Team**: Choose specific teams or users from the dropdown.',
                            '3. **Assign Access**: Select permission level (View/Edit/All) from the dropdown, then click **Add**.'
                        ],
                        vi: [
                            '1. **Quyền Trưởng Nhóm**: Lưu ý rằng các quyền sẽ được chuyển tiếp cho các trưởng nhóm.',
                            '2. **Chọn Người dùng/Nhóm**: Chọn các nhóm hoặc người dùng cụ thể từ danh sách thả xuống.',
                            '3. **Gán Quyền Truy Cập**: Chọn cấp độ quyền (Xem/Sửa/Tất cả) từ danh sách thả xuống, sau đó nhấp vào **Thêm**.'
                        ],
                        ja: [
                            '1. **リーダー権限**: 権限はチームリーダーに継承されることに注意してください。',
                            '2. **ユーザー/チームの選択**: ドロップダウンから特定のチームまたはユーザーを選択します。',
                            '3. **アクセスの割り当て**: ドロップダウンから権限レベル（表示/編集/すべて）を選択し、**追加**をクリックします。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'actions',
            tabTitle: { en: 'Actions & Search', vi: 'Tìm Kiếm & Thao Tác', ja: '検索とアクション' },
            steps: [
                {
                    id: 'step3',
                    title: { en: 'Search and Filter', vi: 'Tìm Kiếm và Lọc', ja: '検索とフィルタ' },
                    description: {
                        en: 'Find prompts quickly using search and tags.',
                        vi: 'Tìm gợi ý nhanh chóng bằng cách tìm kiếm và thẻ.',
                        ja: '検索とタグを使用してプロンプトをすばやく見つけます。'
                    },
                    details: {
                        en: [
                            '1. **Search**: Type keywords in the search bar.',
                            '2. **Filter**: Use the tag dropdown (e.g., "test") to narrow results.'
                        ],
                        vi: [
                            '1. **Tìm kiếm**: Nhập từ khóa vào thanh tìm kiếm.',
                            '2. **Bộ lọc**: Sử dụng danh sách thả xuống thẻ (ví dụ: "test") để thu hẹp kết quả.'
                        ],
                        ja: [
                            '1. **検索**: 検索バーにキーワードを入力します。',
                            '2. **フィルタ**: タグドロップダウン（例：「test」）を使用して結果を絞り込みます。'
                        ]
                    }
                },
                {
                    id: 'step4',
                    title: { en: 'Action Buttons', vi: 'Nút Thao Tác', ja: 'アクションボタン' },
                    description: {
                        en: 'Manage existing prompts and view feedback.',
                        vi: 'Quản lý các gợi ý hiện có và xem phản hồi.',
                        ja: '既存のプロンプトを管理し、フィードバックを表示します。'
                    },
                    details: {
                        en: [
                            '1. **Feedback**: View thumbs up/down counts.',
                            '2. **Edit** (Pencil): Modify the prompt content.',
                            '3. **Delete** (Trash): Remove the prompt from the library.'
                        ],
                        vi: [
                            '1. **Phản hồi**: Xem số lượng thích/không thích.',
                            '2. **Chỉnh sửa** (Bút chì): Sửa đổi nội dung gợi ý.',
                            '3. **Xóa** (Thùng rác): Xóa gợi ý khỏi thư viện.'
                        ],
                        ja: [
                            '1. **フィードバック**: 高評価/低評価の数を確認します。',
                            '2. **編集** (鉛筆): プロンプトの内容を変更します。',
                            '3. **削除** (ゴミ箱): ライブラリからプロンプトを削除します。'
                        ]
                    }
                }
            ]
        }
    ]
};
