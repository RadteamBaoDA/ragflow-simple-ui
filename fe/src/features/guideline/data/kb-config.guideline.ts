import { IFeatureGuideline } from './types';

export const kbConfigGuideline: IFeatureGuideline = {
    featureId: 'kb-config',
    roleRequired: 'leader',
    overview: {
        en: 'Configure and manage your organization\'s AI sources. Add new knowledge bases, manage permissions, and update settings.',
        vi: 'Cấu hình và quản lý các nguồn AI của tổ chức. Thêm cơ sở tri thức mới, quản lý quyền và cập nhật cài đặt.',
        ja: '組織のAIソースを設定および管理します。新しいナレッジベースを追加し、権限を管理し、設定を更新します。'
    },
    tabs: [
        {
            tabId: 'configuration',
            tabTitle: { en: 'Configuration', vi: 'Cấu Hình', ja: '設定' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Add Source', vi: 'Thêm Nguồn', ja: 'ソースを追加' },
                    description: {
                        en: 'Connect new data sources to your knowledge base.',
                        vi: 'Kết nối các nguồn dữ liệu mới vào cơ sở tri thức của bạn.',
                        ja: '新しいデータソースをナレッジベースに接続します。'
                    },
                    details: {
                        en: [
                            '1. Click "+ Add Source" in the top right.',
                            '2. Provide a name and the URL of the data source.',
                            '3. Set the visibility (Public or Private) for the new source.'
                        ],
                        vi: [
                            '1. Nhấp vào "+ Thêm nguồn" ở góc trên bên phải.',
                            '2. Cung cấp tên và URL của nguồn dữ liệu.',
                            '3. Đặt chế độ hiển thị (Công khai hoặc Riêng tư) cho nguồn mới.'
                        ],
                        ja: [
                            '1. 右上の「+ ソースを追加」をクリックします。',
                            '2. データソースの名前とURLを指定します。',
                            '3. 新しいソースの可視性（公開または非公開）を設定します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Manage Permissions', vi: 'Quản Lý Quyền', ja: '権限管理' },
                    description: {
                        en: 'Control who can access different knowledge sources.',
                        vi: 'Kiểm soát ai có thể truy cập các nguồn kiến thức khác nhau.',
                        ja: '誰がどの知識ソースにアクセスできるかを制御します。'
                    },
                    details: {
                        en: [
                            '1. Locate a source in the list and click the Shield icon.',
                            '2. Add specific teams or users to the access list.',
                            '3. Save changes to enforce the new access control policies.'
                        ],
                        vi: [
                            '1. Tìm nguồn trong danh sách và nhấp vào biểu tượng Khiên.',
                            '2. Thêm các nhóm hoặc người dùng cụ thể vào danh sách truy cập.',
                            '3. Lưu thay đổi để áp dụng các chính sách kiểm soát truy cập mới.'
                        ],
                        ja: [
                            '1. リスト内のソースを見つけて、盾のアイコンをクリックします。',
                            '2. 特定のチームまたはユーザーをアクセスリストに追加します。',
                            '3. 変更を保存して、新しいアクセス制御ポリシーを適用します。'
                        ]
                    }
                }
            ]
        }
    ]
};
