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
            tabId: 'histories',
            tabTitle: { en: 'System Histories', vi: 'Lịch Sử Hệ Thống', ja: 'システム履歴' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Review Logs', vi: 'Xem Nhật Ký', ja: 'ログ確認' },
                    description: {
                        en: 'Access complete chat logs from all users.',
                        vi: 'Truy cập nhật ký trò chuyện đầy đủ của tất cả người dùng.',
                        ja: 'すべてのユーザーの完全なチャットログにアクセスします。'
                    },
                    details: {
                        en: [
                            '1. Navigate to the "Histories" page from the admin menu.',
                            '2. Use filters to view logs by user, date, or topic.',
                            '3. Export logs for compliance audits if enabled.'
                        ],
                        vi: [
                            '1. Điều hướng đến trang "Lịch sử" từ menu quản trị.',
                            '2. Sử dụng các bộ lọc để xem nhật ký theo người dùng, ngày tháng hoặc chủ đề.',
                            '3. Xuất nhật ký để kiểm toán tuân thủ nếu được bật.'
                        ],
                        ja: [
                            '1. 管理メニューから「履歴」ページに移動します。',
                            '2. フィルタを使用して、ユーザー、日付、またはトピックごとにログを表示します。',
                            '3. 有効になっている場合は、コンプライアンス監査のためにログをエクスポートします。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Analytics', vi: 'Phân Tích', ja: '分析' },
                    description: {
                        en: 'Analyze usage patterns and system performance.',
                        vi: 'Phân tích các mẫu sử dụng và hiệu suất hệ thống.',
                        ja: '使用パターンとシステムパフォーマンスを分析します。'
                    },
                    details: {
                        en: [
                            '1. Check the dashboard charts for usage trends.',
                            '2. Identify peak usage times or frequent topics.',
                            '3. Use insights to optimize system resources.'
                        ],
                        vi: [
                            '1. Kiểm tra biểu đồ bảng điều khiển để biết xu hướng sử dụng.',
                            '2. Xác định thời gian sử dụng cao điểm hoặc các chủ đề thường xuyên.',
                            '3. Sử dụng thông tin chi tiết để tối ưu hóa tài nguyên hệ thống.'
                        ],
                        ja: [
                            '1. 使用傾向については、ダッシュボードのグラフを確認してください。',
                            '2. ピーク時の使用時間や頻繁なトピックを特定します。',
                            '3. インサイトを使用してシステムリソースを最適化します。'
                        ]
                    }
                }
            ]
        }
    ]
};
