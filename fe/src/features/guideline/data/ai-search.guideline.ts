import { IFeatureGuideline } from './types';

export const aiSearchGuideline: IFeatureGuideline = {
    featureId: 'ai-search',
    roleRequired: 'user',
    overview: {
        en: 'Discover how to search through your knowledge base effectively. Use semantic search, filters, and understand AI-generated summaries.',
        vi: 'Khám phá cách tìm kiếm thông qua cơ sở kiến thức của bạn một cách hiệu quả. Sử dụng tìm kiếm ngữ nghĩa, bộ lọc và hiểu các tóm tắt do AI tạo ra.',
        ja: 'ナレッジベースを効果的に検索する方法を学びます。セマンティック検索、フィルタを使用し、AI生成の要約を理解します。'
    },
    tabs: [
        {
            tabId: 'searchQuery',
            tabTitle: { en: 'Search Query', vi: 'Truy Vấn', ja: '検索クエリ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Enter Keywords', vi: 'Nhập Từ Khóa', ja: 'キーワードを入力' },
                    description: {
                        en: 'Type your question or keywords naturally.',
                        vi: 'Nhập câu hỏi hoặc từ khóa của bạn một cách tự nhiên.',
                        ja: '質問やキーワードを自然に入力します。'
                    },
                    details: {
                        en: [
                            '1. Locate the main search bar in the center of the page.',
                            '2. Enter a natural language question (e.g., "financial report 2024").',
                            '3. Press Enter to initiate the semantic search.'
                        ],
                        vi: [
                            '1. Tìm thanh tìm kiếm chính ở giữa trang.',
                            '2. Nhập câu hỏi bằng ngôn ngữ tự nhiên (ví dụ: "báo cáo tài chính 2024").',
                            '3. Nhấn Enter để bắt đầu tìm kiếm ngữ nghĩa.'
                        ],
                        ja: [
                            '1. ページ中央のメイン検索バーを見つけます。',
                            '2. 自然言語で質問を入力します（例：「2024年財務報告書」）。',
                            '3. Enterを押してセマンティック検索を開始します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'resultView',
            tabTitle: { en: 'Result View', vi: 'Xem Kết Quả', ja: '結果ビュー' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'AI Summary', vi: 'Tóm Tắt AI', ja: 'AI要約' },
                    description: {
                        en: 'View a concise summary generated from retrieved documents.',
                        vi: 'Xem tóm tắt ngắn gọn được tạo từ các tài liệu đã truy xuất.',
                        ja: '検索されたドキュメントから生成された簡潔な要約を表示します。'
                    },
                    details: {
                        en: [
                            '1. The top section displays an AI-generated answer.',
                            '2. Read the summary for a quick understanding of the topic.',
                            '3. Check the citations to verify the information source.'
                        ],
                        vi: [
                            '1. Phần trên cùng hiển thị câu trả lời do AI tạo ra.',
                            '2. Đọc bản tóm tắt để hiểu nhanh về chủ đề.',
                            '3. Kiểm tra các trích dẫn để xác minh nguồn thông tin.'
                        ],
                        ja: [
                            '1. 上部セクションには、AI生成の回答が表示されます。',
                            '2. トピックを素早く理解するために要約を読みます。',
                            '3. 情報源を確認するために引用をチェックします。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Source Files', vi: 'Tệp Nguồn', ja: 'ソースファイル' },
                    description: {
                        en: 'Check the original files referenced in the summary.',
                        vi: 'Kiểm tra các tệp gốc được tham chiếu trong phần tóm tắt.',
                        ja: '要約で参照されている元のファイルを確認します。'
                    },
                    details: {
                        en: [
                            '1. Scroll down to see the list of "Source Files".',
                            '2. Click on a file name to preview its content.',
                            '3. Download the file if you need the full original document.'
                        ],
                        vi: [
                            '1. Cuộn xuống để xem danh sách "Tệp Nguồn".',
                            '2. Nhấp vào tên tệp để xem trước nội dung.',
                            '3. Tải xuống tệp nếu bạn cần toàn bộ tài liệu gốc.'
                        ],
                        ja: [
                            '1. 下にスクロールして「ソースファイル」のリストを表示します。',
                            '2. ファイル名をクリックしてコンテンツをプレビューします。',
                            '3. 完全な元のドキュメントが必要な場合は、ファイルをダウンロードします。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'metadataFilters',
            tabTitle: { en: 'Filters', vi: 'Bộ Lọc', ja: 'フィルタ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Filter Results', vi: 'Lọc Kết Quả', ja: '結果をフィルタ' },
                    description: {
                        en: 'Refine search results by file type, date, or other metadata.',
                        vi: 'Tinh chỉnh kết quả tìm kiếm theo loại tệp, ngày tháng hoặc siêu dữ liệu khác.',
                        ja: 'ファイルタイプ、日付、またはその他のメタデータで検索結果を絞り込みます。'
                    },
                    details: {
                        en: [
                            '1. Click on the "Filter" button near the search bar.',
                            '2. Choose specific file types (e.g., PDF, DOCX) or kb categories.',
                            '3. Set a date range to find recent documents only.'
                        ],
                        vi: [
                            '1. Nhấp vào nút "Bộ lọc" gần thanh tìm kiếm.',
                            '2. Chọn các loại tệp cụ thể (ví dụ: PDF, DOCX) hoặc danh mục kb.',
                            '3. Đặt phạm vi ngày để chỉ tìm các tài liệu gần đây.'
                        ],
                        ja: [
                            '1. 検索バーの近くにある「フィルタ」ボタンをクリックします。',
                            '2. 特定のファイルタイプ（例：PDF、DOCX）またはKBカテゴリを選択します。',
                            '3. 日付範囲を設定して、最近のドキュメントのみを検索します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'historySearch',
            tabTitle: { en: 'History Search', vi: 'Tìm Lịch Sử', ja: '履歴検索' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Find Past Queries', vi: 'Tìm Truy Vấn Cũ', ja: '過去のクエリを検索' },
                    description: {
                        en: 'Locate previous search sessions easily.',
                        vi: 'Dễ dàng xác định vị trí các phiên tìm kiếm trước đó.',
                        ja: '前回の検索セッションを簡単に見つけます。'
                    },
                    details: {
                        en: [
                            '1. Access the history sidebar on the left.',
                            '2. Use the search box above the history list.',
                            '3. Type keywords from your past queries to filter the list.'
                        ],
                        vi: [
                            '1. Truy cập thanh bên lịch sử ở bên trái.',
                            '2. Sử dụng hộp tìm kiếm phía trên danh sách lịch sử.',
                            '3. Nhập từ khóa từ các truy vấn trước đây của bạn để lọc danh sách.'
                        ],
                        ja: [
                            '1. 左側の履歴サイドバーにアクセスします。',
                            '2. 履歴リストの上にある検索ボックスを使用します。',
                            '3. 過去のクエリからキーワードを入力してリストをフィルタリングします。'
                        ]
                    }
                }
            ]
        }
    ],
    tourSteps: [
        {
            target: '#search-input',
            content: { en: 'Enter your search query here.', vi: 'Nhập truy vấn tìm kiếm của bạn tại đây.', ja: 'ここに検索クエリを入力します。' }
        }
    ]
};
