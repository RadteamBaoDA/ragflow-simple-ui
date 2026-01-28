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
                    title: { en: 'System Defaults', vi: 'Mặc Định Hệ Thống', ja: 'システムのデフォルト' },
                    description: {
                        en: 'Set default knowledge bases for Chat and Search.',
                        vi: 'Thiết lập cơ sở tri thức mặc định cho Trò chuyện và Tìm kiếm.',
                        ja: 'チャットと検索のデフォルトのナレッジベースを設定します。'
                    },
                    details: {
                        en: [
                            '1. Switch between **Chat** and **Search** tabs.',
                            '2. Select a source from the dropdown menu (only public sources allowed).',
                            '3. Click **Save** to apply the change.',
                            '4. Click the **Open** icon to test the URL in a new tab.'
                        ],
                        vi: [
                            '1. Chuyển đổi giữa các tab **Trò chuyện** và **Tìm kiếm**.',
                            '2. Chọn một nguồn từ menu thả xuống (chỉ cho phép các nguồn công khai).',
                            '3. Nhấp vào **Lưu** để áp dụng thay đổi.',
                            '4. Nhấp vào biểu tượng **Mở** để kiểm tra URL trong tab mới.'
                        ],
                        ja: [
                            '1. **チャット**タブと**検索**タブを切り替えます。',
                            '2. ドロップダウンメニューからソースを選択します（公開ソースのみ許可）。',
                            '3. **保存**をクリックして変更を適用します。',
                            '4. **開く**アイコンをクリックして、新しいタブでURLをテストします。'
                        ]
                    }
                },
                {
                    id: 'step2',
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
                    id: 'step3',
                    title: { en: 'Source Actions', vi: 'Thao Tác Nguồn', ja: 'ソースアクション' },
                    description: {
                        en: 'Edit, secure, or remove sources.',
                        vi: 'Chỉnh sửa, bảo mật hoặc xóa nguồn.',
                        ja: 'ソースの編集、保護、または削除。'
                    },
                    details: {
                        en: [
                            '1. **Edit** (Pencil): Open dialog to modify Name, URL, Share ID, Description, and Chat Widget URL.',
                            '2. **Permissions** (Shield): Open modal to toggle "System-wide Access" or assign specific Users/Teams.',
                            '3. **Delete** (Trash): Permanently remove the source after confirmation.'
                        ],
                        vi: [
                            '1. **Chỉnh sửa** (Bút chì): Mở hộp thoại để sửa Tên, URL, ID Chia sẻ, Mô tả và URL Widget Trò chuyện.',
                            '2. **Quyền** (Khiên): Mở phương thức để bật "Truy cập toàn hệ thống" hoặc gán Người dùng/Nhóm cụ thể.',
                            '3. **Xóa** (Thùng rác): Xóa vĩnh viễn nguồn sau khi xác nhận.'
                        ],
                        ja: [
                            '1. **編集** (鉛筆): ダイアログを開いて、名前、URL、共有ID、説明、チャットウィジェットURLを変更します。',
                            '2. **権限** (盾): モーダルを開いて、「システム全体のアクセス」を切り替えるか、特定のユーザー/チームを割り当てます。',
                            '3. **削除** (ゴミ箱): 確認後にソースを完全に削除します。'
                        ]
                    }
                }
            ]
        }
    ]
};
