import { IFeatureGuideline } from './types';

export const usersGuideline: IFeatureGuideline = {
    featureId: 'users',
    roleRequired: 'admin',
    overview: {
        en: 'User Management. View and manage all registered users, assign roles, and filtering.',
        vi: 'Quản lý Người dùng. Xem và quản lý tất cả người dùng đã đăng ký, gán vai trò và lọc.',
        ja: 'ユーザー管理。登録されているすべてのユーザーを表示および管理し、役割を割り当て、フィルタリングします。'
    },
    tabs: [
        {
            tabId: 'list',
            tabTitle: { en: 'User List & Filters', vi: 'Danh Sách & Bộ Lọc', ja: 'ユーザーリストとフィルタ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Search & Filters', vi: 'Tìm Kiếm & Bộ Lọc', ja: '検索とフィルタ' },
                    description: {
                        en: 'Find users effectively using search and filters.',
                        vi: 'Tìm người dùng hiệu quả bằng cách sử dụng tìm kiếm và bộ lọc.',
                        ja: '検索とフィルタを使用してユーザーを効果的に検索します。'
                    },
                    details: {
                        en: [
                            '1. **Search Bar**: Enter name or email to find specific users.',
                            '2. **Role Filter**: Select "All Roles", "Admin", "Leader", or "User" to filter the list.',
                            '3. **Department Filter**: Narrow down users by selecting a specific department.'
                        ],
                        vi: [
                            '1. **Thanh Tìm Kiếm**: Nhập tên hoặc email để tìm người dùng cụ thể.',
                            '2. **Bộ Lọc Vai Trò**: Chọn "Tất cả vai trò", "Admin", "Leader", hoặc "User" để lọc danh sách.',
                            '3. **Bộ Lọc Phòng Ban**: Thu hẹp danh sách người dùng bằng cách chọn phòng ban cụ thể.'
                        ],
                        ja: [
                            '1. **検索バー**: 名前またはメールアドレスを入力して、特定のユーザーを検索します。',
                            '2. **役割フィルタ**: 「すべての役割」、「管理者」、「リーダー」、または「ユーザー」を選択してリストをフィルタリングします。',
                            '3. **部署フィルタ**: 特定の部署を選択してユーザーを絞り込みます。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'actions',
            tabTitle: { en: 'User Actions', vi: 'Thao Tác Người Dùng', ja: 'ユーザーアクション' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'View IP History', vi: 'Xem Lịch Sử IP', ja: 'IP履歴を表示' },
                    description: {
                        en: 'Monitor user login activity.',
                        vi: 'Giám sát hoạt động đăng nhập của người dùng.',
                        ja: 'ユーザーのログインアクティビティを監視します。'
                    },
                    details: {
                        en: [
                            '1. **Click Globe Icon**: Located in the "Actions" column (first button).',
                            '2. **Review Dialog**: View the list of IP addresses and "Last Access" timestamps for the user.'
                        ],
                        vi: [
                            '1. **Nhấp Biểu Tượng Quả Địa Cầu**: Nằm trong cột "Hành động" (nút đầu tiên).',
                            '2. **Xem Hộp Thoại**: Xem danh sách địa chỉ IP và thời gian "Truy cập lần cuối" của người dùng.'
                        ],
                        ja: [
                            '1. **地球儀アイコンをクリック**: 「アクション」列（最初のボタン）にあります。',
                            '2. **ダイアログを確認**: ユーザーのIPアドレスと「最終アクセス」タイムスタンプのリストを表示します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Edit User Role', vi: 'Sửa Vai Trò Người Dùng', ja: 'ユーザー役割の編集' },
                    description: {
                        en: 'Change user permissions and roles.',
                        vi: 'Thay đổi quyền và vai trò của người dùng.',
                        ja: 'ユーザーの権限と役割を変更します。'
                    },
                    details: {
                        en: [
                            '1. **Click Pencil Icon**: Located in the "Actions" column (second button).',
                            '2. **Select Role**: Choose from **Admin** (Full access), **Leader** (Manage content), or **User** (Standard access).',
                            '3. **Save Changes**: Click the blue button to apply the new role immediately.'
                        ],
                        vi: [
                            '1. **Nhấp Biểu Tượng Bút Chì**: Nằm trong cột "Hành động" (nút thứ hai).',
                            '2. **Chọn Vai Trò**: Chọn từ **Admin** (Toàn quyền), **Leader** (Quản lý nội dung), hoặc **User** (Truy cập tiêu chuẩn).',
                            '3. **Lưu Thay Đổi**: Nhấp vào nút màu xanh để áp dụng vai trò mới ngay lập tức.'
                        ],
                        ja: [
                            '1. **鉛筆アイコンをクリック**: 「アクション」列（2番目のボタン）にあります。',
                            '2. **役割を選択**: **管理者**（フルアクセス）、**リーダー**（コンテンツ管理）、または**ユーザー**（標準アクセス）から選択します。',
                            '3. **変更を保存**: 青いボタンをクリックして、新しい役割を即座に適用します。'
                        ]
                    }
                }
            ]
        }
    ]
};
