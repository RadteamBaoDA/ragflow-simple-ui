import { IFeatureGuideline } from './types';

export const auditGuideline: IFeatureGuideline = {
    featureId: 'audit',
    roleRequired: 'admin',
    overview: {
        en: 'System Audit Logs. Review all user activities, system changes, and security events.',
        vi: 'Nhật ký Kiểm toán Hệ thống. Xem xét tất cả các hoạt động của người dùng, thay đổi hệ thống và sự kiện bảo mật.',
        ja: 'システム監査ログ。すべてのユーザーアクティビティ、システム変更、およびセキュリティイベントを確認します。'
    },
    tabs: [
        {
            tabId: 'audit',
            tabTitle: { en: 'Audit Logs', vi: 'Nhật Ký', ja: '監査ログ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Monitor Activity', vi: 'Giám Sát Hoạt Động', ja: 'アクティビティ監視' },
                    description: {
                        en: 'Track who did what and when.',
                        vi: 'Theo dõi ai đã làm gì và khi nào.',
                        ja: '誰がいつ何をしたかを追跡します。'
                    },
                    details: {
                        en: [
                            '1. Access the main audit table to see realtime events.',
                            '2. Columns typically include Timestamp, User, Action, and IP Address.',
                            '3. Click on row details to view raw JSON data for debugging.'
                        ],
                        vi: [
                            '1. Truy cập bảng kiểm toán chính để xem các sự kiện thời gian thực.',
                            '2. Các cột thường bao gồm Dấu thời gian, Người dùng, Hành động và Địa chỉ IP.',
                            '3. Nhấp vào chi tiết hàng để xem dữ liệu JSON thô để gỡ lỗi.'
                        ],
                        ja: [
                            '1. メイン監査テーブルにアクセスして、リアルタイムイベントを確認します。',
                            '2. 列には通常、タイムスタンプ、ユーザー、アクション、およびIPアドレスが含まれます。',
                            '3. 行の詳細をクリックして、デバッグ用の生のJSONデータを表示します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Filter Logs', vi: 'Lọc Nhật Ký', ja: 'ログフィルタ' },
                    description: {
                        en: 'Filter by user, action type, or date.',
                        vi: 'Lọc theo người dùng, loại hành động hoặc ngày tháng.',
                        ja: 'ユーザー、アクションタイプ、または日付でフィルタリングします。'
                    },
                    details: {
                        en: [
                            '1. Click the filter icon to open the filter dialog.',
                            '2. Search for a specific User ID or Action type (e.g., LOGIN_FAILED).',
                            '3. **Start Date**: Click the date picker and select the beginning date of your range.',
                            '4. **End Date**: Click the date picker and select the ending date of your range.',
                            '5. Click **"Apply Filters"** to filter the audit logs by the selected criteria.',
                            '6. Click **"Reset"** to clear all filters and show all logs.',
                            '7. Export filtered results to CSV for external analysis.'
                        ],
                        vi: [
                            '1. Nhấp vào biểu tượng bộ lọc để mở hộp thoại bộ lọc.',
                            '2. Tìm kiếm ID người dùng hoặc loại Hành động cụ thể (ví dụ: LOGIN_FAILED).',
                            '3. **Ngày Bắt Đầu**: Nhấp vào bộ chọn ngày và chọn ngày bắt đầu của phạm vi.',
                            '4. **Ngày Kết Thúc**: Nhấp vào bộ chọn ngày và chọn ngày kết thúc của phạm vi.',
                            '5. Nhấp **"Áp Dụng Bộ Lọc"** để lọc nhật ký kiểm toán theo các tiêu chí đã chọn.',
                            '6. Nhấp **"Đặt Lại"** để xóa tất cả bộ lọc và hiển thị tất cả nhật ký.',
                            '7. Xuất kết quả đã lọc sang CSV để phân tích bên ngoài.'
                        ],
                        ja: [
                            '1. フィルタアイコンをクリックしてフィルタダイアログを開きます。',
                            '2. 特定のユーザーIDまたはアクションタイプ（例：LOGIN_FAILED）を検索します。',
                            '3. **開始日**: 日付ピッカーをクリックして、範囲の開始日を選択します。',
                            '4. **終了日**: 日付ピッカーをクリックして、範囲の終了日を選択します。',
                            '5. **「フィルタを適用」** をクリックして、選択した基準で監査ログをフィルタリングします。',
                            '6. **「リセット」** をクリックして、すべてのフィルタをクリアし、すべてのログを表示します。',
                            '7. フィルタリングされた結果をCSVにエクスポートして、外部分析を行います。'
                        ]
                    }
                }
            ]
        }
    ]
};
