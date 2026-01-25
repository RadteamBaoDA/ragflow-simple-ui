import { IFeatureGuideline } from './types';

export const iamGuideline: IFeatureGuideline = {
    featureId: 'iam',
    roleRequired: 'admin',
    overview: {
        en: 'Identity & Access Management. Control user lifecycle, create teams, and assign roles across the platform.',
        vi: 'Quản lý Danh tính & Quyền truy cập. Kiểm soát vòng đời người dùng, tạo nhóm và gán vai trò trên nền tảng.',
        ja: 'IDおよびアクセス管理。ユーザーのライフサイクルを制御し、チームを作成し、プラットフォーム全体で役割を割り当てます。'
    },
    tabs: [
        {
            tabId: 'users',
            tabTitle: { en: 'Users', vi: 'Người Dùng', ja: 'ユーザー' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'User List', vi: 'Danh Sách Người Dùng', ja: 'ユーザーリスト' },
                    description: {
                        en: 'View and manage all registered users.',
                        vi: 'Xem và quản lý tất cả người dùng đã đăng ký.',
                        ja: '登録されているすべてのユーザーを表示および管理します。'
                    },
                    details: {
                        en: [
                            '1. Navigate to the Users URL in the admin dashboard.',
                            '2. View the table of all active and suspended users.',
                            '3. Use the search bar to find a specific user by email or name.'
                        ],
                        vi: [
                            '1. Điều hướng đến URL Người dùng trong bảng điều khiển quản trị.',
                            '2. Xem bảng của tất cả người dùng đang hoạt động và bị đình chỉ.',
                            '3. Sử dụng thanh tìm kiếm để tìm một người dùng cụ thể bằng email hoặc tên.'
                        ],
                        ja: [
                            '1. 管理ダッシュボードのユーザーURLに移動します。',
                            '2. すべてのアクティブおよび一時停止中のユーザーのテーブルを表示します。',
                            '3. 検索バーを使用して、電子メールまたは名前で特定のユーザーを検索します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Edit Roles', vi: 'Sửa Vai Trò', ja: '役割を編集' },
                    description: {
                        en: 'Assign roles like User, Leader, or Admin.',
                        vi: 'Gán các vai trò như Người dùng, Trưởng nhóm hoặc Quản trị viên.',
                        ja: 'ユーザー、リーダー、管理者などの役割を割り当てます。'
                    },
                    details: {
                        en: [
                            '1. Click the "Edit" (pencil) icon next to a user.',
                            '2. Select a new role from the dropdown menu.',
                            '3. Confirm usage limits and save the new role assignment.'
                        ],
                        vi: [
                            '1. Nhấp vào biểu tượng "Chỉnh sửa" (bút chì) bên cạnh người dùng.',
                            '2. Chọn vai trò mới từ menu thả xuống.',
                            '3. Xác nhận giới hạn sử dụng và lưu gán vai trò mới.'
                        ],
                        ja: [
                            '1. ユーザーの横にある「編集」（鉛筆）アイコンをクリックします。',
                            '2. ドロップダウンメニューから新しい役割を選択します。',
                            '3. 使用制限を確認し、新しい役割の割り当てを保存します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'teams',
            tabTitle: { en: 'Teams', vi: 'Nhóm', ja: 'チーム' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Create Team', vi: 'Tạo Nhóm', ja: 'チーム作成' },
                    description: {
                        en: 'Group users into teams for easier management.',
                        vi: 'Gom người dùng thành các nhóm để quản lý dễ dàng hơn.',
                        ja: '管理を容易にするためにユーザーをチームにグループ化します。'
                    },
                    details: {
                        en: [
                            '1. Go to the "Teams" tab.',
                            '2. Click "Create Team" and provide a team name.',
                            '3. Add members to the team and assign a team leader.'
                        ],
                        vi: [
                            '1. Đi đến tab "Nhóm".',
                            '2. Nhấp vào "Tạo nhóm" và cung cấp tên nhóm.',
                            '3. Thêm thành viên vào nhóm và chỉ định trưởng nhóm.'
                        ],
                        ja: [
                            '1. 「チーム」タブに移動します。',
                            '2. 「チーム作成」をクリックし、チーム名を指定します。',
                            '3. チームにメンバーを追加し、チームリーダーを割り当てます。'
                        ]
                    }
                }
            ]
        }
    ]
};
