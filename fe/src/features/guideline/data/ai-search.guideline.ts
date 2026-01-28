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
                    title: { en: 'Select Search Agent', vi: 'Chọn Agent Tìm Kiếm', ja: '検索エージェントを選択' },
                    description: {
                        en: 'Choose the specialized agent for your search needs.',
                        vi: 'Chọn agent chuyên biệt cho nhu cầu tìm kiếm của bạn.',
                        ja: '検索ニーズに合わせて専門のエージェントを選択します。'
                    },
                    details: {
                        en: [
                            '1. Locate the agent dropdown at the top of the search page.',
                            '2. Select an agent (e.g., "General Search", "Technical Docs").',
                            '3. This ensures the search is optimized for the specific context.'
                        ],
                        vi: [
                            '1. Tìm menu thả xuống agent ở đầu trang tìm kiếm.',
                            '2. Chọn một agent (ví dụ: "Tìm kiếm chung", "Tài liệu kỹ thuật").',
                            '3. Điều này đảm bảo việc tìm kiếm được tối ưu hóa cho ngữ cảnh cụ thể.'
                        ],
                        ja: [
                            '1. 検索ページ上部のエージェントドロップダウンを見つけます。',
                            '2. エージェントを選択します（例：「一般検索」、「技術文書」）。',
                            '3. これにより、特定のコンテキストに合わせて検索が最適化されます。'
                        ]
                    }
                },
                {
                    id: 'step2',
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
                            '2. Hover over citation tags (e.g., Fig. X) to see an image or text overview.',
                            '3. Click the file icon in the popup to open the file review dialog.',
                            '4. Click the **Like** or **Dislike** buttons to provide feedback on the answer.'
                        ],
                        vi: [
                            '1. Phần trên cùng hiển thị câu trả lời do AI tạo ra.',
                            '2. Di chuột qua thẻ trích dẫn (ví dụ: Fig. X) để xem hình ảnh hoặc văn bản tổng quan.',
                            '3. Nhấp vào biểu tượng tệp trong cửa sổ bật lên để mở hộp thoại xem lại tệp.',
                            '4. Nhấp vào nút **Thích** hoặc **Không thích** để phản hồi về câu trả lời.'
                        ],
                        ja: [
                            '1. 上部セクションには、AI生成の回答が表示されます。',
                            '2. 引用タグ（例：Fig. X）にマウスを合わせると、画像またはテキストの概要が表示されます。',
                            '3. ポップアップ内のファイルアイコンをクリックして、ファイルレビューダイアログを開きます。',
                            '4. 回答にフィードバックを提供するには、**いいね**または**よくないね**ボタンをクリックします。'
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
                            '2. Use the dropdown menu to filter files within the result view.',
                            '3. View file thumbnails to quickly identify content.',
                            '4. Click on a file name to preview its full content.'
                        ],
                        vi: [
                            '1. Cuộn xuống để xem danh sách "Tệp Nguồn".',
                            '2. Sử dụng menu thả xuống để lọc các tệp trong chế độ xem kết quả.',
                            '3. Xem hình thu nhỏ của tệp để xác định nhanh nội dung.',
                            '4. Nhấp vào tên tệp để xem trước toàn bộ nội dung.'
                        ],
                        ja: [
                            '1. 下にスクロールして「ソースファイル」のリストを表示します。',
                            '2. ドロップダウンメニューを使用して、結果ビュー内のファイルをフィルタリングします。',
                            '3. ファイルのサムネイルを表示して、コンテンツをすばやく識別します。',
                            '4. ファイル名をクリックして、完全なコンテンツをプレビューします。'
                        ]
                    }
                },
                {
                    id: 'step3',
                    title: { en: 'Other controls', vi: 'Các điều khiển khác', ja: 'その他のコントロール' },
                    description: {
                        en: 'Utilities for helping the search view.',
                        vi: 'Các tiện ích hỗ trợ chế độ xem tìm kiếm.',
                        ja: '検索ビューを支援するユーティリティ。'
                    },
                    details: {
                        en: [
                            '1. **Refresh**: Reload the search results to get the latest updates.',
                            '2. **Fullscreen**: Expand the result view to fill the entire screen.',
                            '3. **Chat**: Click the chat icon to open the dialog, discuss results with AI, and click the "X" button to close.',
                            '4. **Pagination**: Navigation buttons to move through multiple pages of results.'
                        ],
                        vi: [
                            '1. **Làm mới**: Tải lại kết quả tìm kiếm để nhận các cập nhật mới nhất.',
                            '2. **Toàn màn hình**: Mở rộng chế độ xem kết quả ra toàn màn hình.',
                            '3. **Trò chuyện**: Nhấp vào biểu tượng trò chuyện để mở hộp thoại, thảo luận kết quả với AI và nhấp vào nút "X" để đóng.',
                            '4. **Phân trang**: Các nút điều hướng để di chuyển qua nhiều trang kết quả.'
                        ],
                        ja: [
                            '1. **更新**: 検索結果を再読み込みして、最新の更新を取得します。',
                            '2. **全画面表示**: 結果ビューを全画面に拡大します。',
                            '3. **チャット**: チャットアイコンをクリックしてダイアログを開き、AIと結果について話し合い、"X"ボタンをクリックして閉じます。',
                            '4. **ページネーション**: 複数の結果ページを移動するためのナビゲーションボタン。'
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
                            '2. Use the search box above the history list to filter by keywords.',
                            '3. Click the filter icon to open the "Filter History" dialog.',
                            '4. **Start Date**: Select the beginning date of your range.',
                            '5. **End Date**: Select the ending date of your range.',
                            '6. Click **"Apply Filters"** to filter history by date range.',
                            '7. Click **"Reset"** to clear filters and show all history.'
                        ],
                        vi: [
                            '1. Truy cập thanh bên lịch sử ở bên trái.',
                            '2. Sử dụng hộp tìm kiếm phía trên danh sách lịch sử để lọc theo từ khóa.',
                            '3. Nhấp vào biểu tượng bộ lọc để mở hộp thoại "Lọc Lịch Sử".',
                            '4. **Ngày Bắt Đầu**: Chọn ngày bắt đầu của phạm vi.',
                            '5. **Ngày Kết Thúc**: Chọn ngày kết thúc của phạm vi.',
                            '6. Nhấp **"Áp Dụng Bộ Lọc"** để lọc lịch sử theo phạm vi ngày.',
                            '7. Nhấp **"Đặt Lại"** để xóa bộ lọc và hiển thị toàn bộ lịch sử.'
                        ],
                        ja: [
                            '1. 左側の履歴サイドバーにアクセスします。',
                            '2. 履歴リストの上にある検索ボックスを使用して、キーワードでフィルタリングします。',
                            '3. フィルタアイコンをクリックして「履歴をフィルタ」ダイアログを開きます。',
                            '4. **開始日**: 範囲の開始日を選択します。',
                            '5. **終了日**: 範囲の終了日を選択します。',
                            '6. **「フィルタを適用」** をクリックして、日付範囲で履歴をフィルタリングします。',
                            '7. **「リセット」** をクリックして、フィルタをクリアし、すべての履歴を表示します。'
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
