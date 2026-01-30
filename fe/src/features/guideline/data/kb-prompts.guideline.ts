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
                    title: { en: 'Prepare Your CSV', vi: 'Chuẩn bị CSV', ja: 'CSVを準備' },
                    description: {
                        en: 'Format your CSV file correctly for bulk import.',
                        vi: 'Định dạng tệp CSV của bạn đúng cách để nhập hàng loạt.',
                        ja: '一括インポート用にCSVファイルを正しくフォーマットします。'
                    },
                    details: {
                        en: [
                            '1. **Required column**: `prompt` - The prompt text (required).',
                            '2. **Optional columns**: `description`, `tags`, `source`.',
                            '3. **Multi-line prompts**: Wrap the entire cell in double quotes.',
                            '4. **Tags**: Separate multiple tags with commas (e.g., "tag1,tag2").',
                            '5. **File limits**: Max 1000 rows, 5MB file size, UTF-8 encoding recommended.'
                        ],
                        vi: [
                            '1. **Cột bắt buộc**: `prompt` - Nội dung prompt (bắt buộc).',
                            '2. **Cột tùy chọn**: `description`, `tags`, `source`.',
                            '3. **Prompt nhiều dòng**: Bao bọc toàn bộ ô trong dấu ngoặc kép.',
                            '4. **Thẻ**: Phân cách nhiều thẻ bằng dấu phẩy (vd: "tag1,tag2").',
                            '5. **Giới hạn tệp**: Tối đa 1000 dòng, 5MB, khuyến nghị mã hóa UTF-8.'
                        ],
                        ja: [
                            '1. **必須列**: `prompt` - プロンプトテキスト（必須）。',
                            '2. **オプション列**: `description`、`tags`、`source`。',
                            '3. **複数行プロンプト**: セル全体をダブルクォートで囲みます。',
                            '4. **タグ**: 複数のタグをカンマで区切ります（例：「tag1,tag2」）。',
                            '5. **ファイル制限**: 最大1000行、5MBファイルサイズ、UTF-8エンコード推奨。'
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
                            '1. Click the **Import CSV** button in the prompt management page.',
                            '2. Click **Download Template** to get a sample CSV format.',
                            '3. Drag and drop your CSV file or click to select.',
                            '4. Review the preview table - valid rows are shown in green, errors in red.',
                            '5. Click **Import** to add prompts. Duplicates are automatically skipped.'
                        ],
                        vi: [
                            '1. Nhấp vào nút **Nhập CSV** trong trang quản lý prompt.',
                            '2. Nhấp **Tải Template** để lấy mẫu định dạng CSV.',
                            '3. Kéo và thả tệp CSV hoặc nhấp để chọn.',
                            '4. Xem bảng xem trước - dòng hợp lệ hiển thị màu xanh, lỗi màu đỏ.',
                            '5. Nhấp **Nhập** để thêm prompt. Các mục trùng lặp sẽ tự động bị bỏ qua.'
                        ],
                        ja: [
                            '1. プロンプト管理ページの **CSVインポート** ボタンをクリックします。',
                            '2. **テンプレートをダウンロード** をクリックしてサンプルCSV形式を取得します。',
                            '3. CSVファイルをドラッグアンドドロップするか、クリックして選択します。',
                            '4. プレビューテーブルを確認 - 有効な行は緑、エラーは赤で表示されます。',
                            '5. **インポート** をクリックしてプロンプトを追加します。重複は自動的にスキップされます。'
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
