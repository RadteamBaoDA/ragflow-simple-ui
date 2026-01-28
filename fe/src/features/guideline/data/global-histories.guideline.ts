import { IFeatureGuideline } from './types';

export const globalHistoriesGuideline: IFeatureGuideline = {
    featureId: 'global-histories',
    roleRequired: 'admin',
    overview: {
        en: 'System-wide Chat History. View standard logs of all chat interactions across the system for compliance and quality assurance.',
        vi: 'Lịch sử Trò chuyện Toàn Hệ thống. Xem nhật ký chuẩn của tất cả các tương tác trò chuyện trên toàn hệ thống để tuân thủ và đảm bảo chất lượng.',
        ja: 'システム全体のチャット履歴。コンプライアンスと品質保証のために、システム全体でのすべてのチャットインタラクションの標準ログを表示します。'
    },
    tabs: [
        {
            tabId: 'chatHistory',
            tabTitle: { en: 'Chat History', vi: 'Lịch Sử Chat', ja: 'チャット履歴' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Monitor Chats', vi: 'Giám Sát Chat', ja: 'チャット監視' },
                    description: {
                        en: 'Review user conversations.',
                        vi: 'Xem lại các cuộc trò chuyện của người dùng.',
                        ja: 'ユーザーの会話を確認します。'
                    },
                    details: {
                        en: [
                            '1. **List View**: See a scrolling list of all chat sessions.',
                            '2. **Session Info**: Each card shows the user email, topic, and message count.',
                            '3. **Click to View**: Select any card to open the full conversation transcript.'
                        ],
                        vi: [
                            '1. **Chế Độ Danh Sách**: Xem danh sách cuộn của tất cả các phiên chat.',
                            '2. **Thông Tin Phiên**: Mỗi thẻ hiển thị email người dùng, chủ đề và số lượng tin nhắn.',
                            '3. **Nhấp Để Xem**: Chọn bất kỳ thẻ nào để mở toàn bộ nội dung cuộc trò chuyện.'
                        ],
                        ja: [
                            '1. **リストビュー**: すべてのチャットセッションのスクロールリストを表示します。',
                            '2. **セッション情報**: 各カードには、ユーザーのメール、トピック、メッセージ数が表示されます。',
                            '3. **クリックして表示**: カードを選択して、完全な会話記録を開きます。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Search & Filter', vi: 'Tìm Kiếm & Lọc', ja: '検索とフィルタ' },
                    description: {
                        en: 'Find specific chat logs.',
                        vi: 'Tìm nhật ký chat cụ thể.',
                        ja: '特定のチャットログを検索します。'
                    },
                    details: {
                        en: [
                            '1. **Search Bar**: Enter keywords, user emails, or topics to find specific sessions.',
                            '2. **Refresh**: Click the circular arrow to reload the list with the latest data.',
                            '3. **Filter**: Click the filter icon to open date range options (Start/End Date).'
                        ],
                        vi: [
                            '1. **Thanh Tìm Kiếm**: Nhập từ khóa, email người dùng hoặc chủ đề để tìm các phiên cụ thể.',
                            '2. **Làm Mới**: Nhấp vào mũi tên tròn để tải lại danh sách với dữ liệu mới nhất.',
                            '3. **Bộ Lọc**: Nhấp vào biểu tượng bộ lọc để mở các tùy chọn khoảng thời gian (Ngày Bắt Đầu/Kết Thúc).'
                        ],
                        ja: [
                            '1. **検索バー**: キーワード、ユーザーのメール、またはトピックを入力して、特定のセッションを検索します。',
                            '2. **更新**: 円形の矢印をクリックして、最新データでリストを再読み込みします。',
                            '3. **フィルタ**: フィルタアイコンをクリックして、日付範囲オプション（開始/終了日）を開きます。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'searchHistory',
            tabTitle: { en: 'Search History', vi: 'Lịch Sử Tìm Kiếm', ja: '検索履歴' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Monitor Queries', vi: 'Giám Sát Truy Vấn', ja: 'クエリ監視' },
                    description: {
                        en: 'Track what users are searching for.',
                        vi: 'Theo dõi những gì người dùng đang tìm kiếm.',
                        ja: 'ユーザーが何を検索しているかを追跡します。'
                    },
                    details: {
                        en: [
                            '1. **Query List**: View a chronological list of search queries submitted by users.',
                            '2. **Details**: Check the query text, user, and timestamp.',
                            '3. **Insights**: Identify popular topics or missing information.'
                        ],
                        vi: [
                            '1. **Danh Sách Truy Vấn**: Xem danh sách theo thời gian các truy vấn tìm kiếm do người dùng gửi.',
                            '2. **Chi Tiết**: Kiểm tra văn bản truy vấn, người dùng và dấu thời gian.',
                            '3. **Thông Tin Chi Tiết**: Xác định các chủ đề phổ biến hoặc thông tin còn thiếu.'
                        ],
                        ja: [
                            '1. **クエリリスト**: ユーザーが送信した検索クエリの時系列リストを表示します。',
                            '2. **詳細**: クエリテキスト、ユーザー、およびタイムスタンプを確認します。',
                            '3. **インサイト**: 人気のあるトピックや不足している情報を特定します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Search & Filter', vi: 'Tìm Kiếm & Lọc', ja: '検索とフィルタ' },
                    description: {
                        en: 'Filter search history logs.',
                        vi: 'Lọc nhật ký lịch sử tìm kiếm.',
                        ja: '検索履歴ログをフィルタリングします。'
                    },
                    details: {
                        en: [
                            '1. **Search Bar**: Filter the history list by typing keywords or user emails.',
                            '2. **Refresh**: Reload to see the most recent search activities.',
                            '3. **Date Filter**: Use the filter icon to restrict logs to a specific time period.'
                        ],
                        vi: [
                            '1. **Thanh Tìm Kiếm**: Lọc danh sách lịch sử bằng cách nhập từ khóa hoặc email người dùng.',
                            '2. **Làm Mới**: Tải lại để xem các hoạt động tìm kiếm gần đây nhất.',
                            '3. **Bộ Lọc Ngày**: Sử dụng biểu tượng bộ lọc để giới hạn nhật ký trong một khoảng thời gian cụ thể.'
                        ],
                        ja: [
                            '1. **検索バー**: キーワードまたはユーザーのメールを入力して、履歴リストをフィルタリングします。',
                            '2. **更新**: 再読み込みして、最新の検索アクティビティを表示します。',
                            '3. **日付フィルタ**: フィルタアイコンを使用して、ログを特定の期間に制限します。'
                        ]
                    }
                }
            ]
        }
    ]
};
