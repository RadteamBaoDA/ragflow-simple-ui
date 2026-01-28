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
            tabId: 'overview',
            tabTitle: { en: 'Overview', vi: 'Tổng Quan', ja: '概要' },
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
                }
            ]
        },
        {
            tabId: 'filters',
            tabTitle: { en: 'Search & Filters', vi: 'Tìm Kiếm & Bộ Lọc', ja: '検索とフィルタ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Search & Refresh', vi: 'Tìm Kiếm & Làm Mới', ja: '検索と更新' },
                    description: {
                        en: 'Find specific logs and update the list.',
                        vi: 'Tìm nhật ký cụ thể và cập nhật danh sách.',
                        ja: '特定のログを検索し、リストを更新します。'
                    },
                    details: {
                        en: [
                            '1. **Search Bar**: Enter user email or details to find specific events.',
                            '2. **Refresh Button**: Click the circular arrow icon to reload the latest logs.',
                            '3. **Filters Button**: Click to toggle the advanced filter panel.'
                        ],
                        vi: [
                            '1. **Thanh Tìm Kiếm**: Nhập email người dùng hoặc chi tiết để tìm sự kiện cụ thể.',
                            '2. **Nút Làm Mới**: Nhấp vào biểu tượng mũi tên tròn để tải lại nhật ký mới nhất.',
                            '3. **Nút Bộ Lọc**: Nhấp để bật/tắt bảng bộ lọc nâng cao.'
                        ],
                        ja: [
                            '1. **検索バー**: ユーザーのメールアドレスまたは詳細を入力して、特定のイベントを検索します。',
                            '2. **更新ボタン**: 円形の矢印アイコンをクリックして、最新のログを再読み込みします。',
                            '3. **フィルタボタン**: クリックして詳細フィルタパネルを切り替えます。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Advanced Filters', vi: 'Bộ Lọc Nâng Cao', ja: '詳細フィルタ' },
                    description: {
                        en: 'Filter logs by specific criteria.',
                        vi: 'Lọc nhật ký theo các tiêu chí cụ thể.',
                        ja: '特定の基準でログをフィルタリングします。'
                    },
                    details: {
                        en: [
                            '1. **Action**: Select a specific action type (e.g., Login, Update, Delete) from the dropdown.',
                            '2. **Resource Type**: Filter by the type of resource affected.',
                            '3. **Date Range**: Use **Start Date** and **End Date** pickers to view logs within a specific period.'
                        ],
                        vi: [
                            '1. **Hành Động**: Chọn loại hành động cụ thể (ví dụ: Đăng nhập, Cập nhật, Xóa) từ danh sách thả xuống.',
                            '2. **Loại Tài Nguyên**: Lọc theo loại tài nguyên bị ảnh hưởng.',
                            '3. **Phạm Vi Ngày**: Sử dụng bộ chọn **Ngày Bắt Đầu** và **Ngày Kết Thúc** để xem nhật ký trong một khoảng thời gian cụ thể.'
                        ],
                        ja: [
                            '1. **アクション**: ドロップダウンから特定のアクションタイプ（例：ログイン、更新、削除）を選択します。',
                            '2. **リソースタイプ**: 影響を受けるリソースのタイプでフィルタリングします。',
                            '3. **日付範囲**: **開始日**と**終了日**のピッカーを使用して、特定の期間内のログを表示します。'
                        ]
                    }
                }
            ]
        }
    ]
};
