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
                            '1. Use the advanced filter controls at the top.',
                            '2. Search for a specific User ID or Action (e.g., LOGIN_FAILED).',
                            '3. Export filtered results to CSV for external analysis.'
                        ],
                        vi: [
                            '1. Sử dụng các điều khiển bộ lọc nâng cao ở trên cùng.',
                            '2. Tìm kiếm ID người dùng hoặc Hành động cụ thể (ví dụ: LOGIN_FAILED).',
                            '3. Xuất kết quả đã lọc sang CSV để phân tích bên ngoài.'
                        ],
                        ja: [
                            '1. 上部にある高度なフィルタコントロールを使用します。',
                            '2. 特定のユーザーIDまたはアクション（例：LOGIN_FAILED）を検索します。',
                            '3. フィルタリングされた結果をCSVにエクスポートして、外部分析を行います。'
                        ]
                    }
                }
            ]
        }
    ]
};
