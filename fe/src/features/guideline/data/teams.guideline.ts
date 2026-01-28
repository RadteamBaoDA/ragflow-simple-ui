import { IFeatureGuideline } from './types';

export const teamsGuideline: IFeatureGuideline = {
    featureId: 'teams',
    roleRequired: 'admin',
    overview: {
        en: 'Team Management. Create teams, assign leaders, and organize users.',
        vi: 'Quản lý Nhóm. Tạo nhóm, chỉ định trưởng nhóm và tổ chức người dùng.',
        ja: 'チーム管理。チームを作成し、リーダーを割り当て、ユーザーを整理します。'
    },
    tabs: [
        {
            tabId: 'info',
            tabTitle: { en: 'General Information', vi: 'Thông Tin Chung', ja: '一般情報' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Create Team', vi: 'Tạo Nhóm', ja: 'チーム作成' },
                    description: {
                        en: 'Create a new team with project details.',
                        vi: 'Tạo nhóm mới với chi tiết dự án.',
                        ja: 'プロジェクトの詳細を含む新しいチームを作成します。'
                    },
                    details: {
                        en: [
                            '1. **Click "+ Create Team"**: Open the creation dialog.',
                            '2. **Fill Details**: Enter **Team Name**, **Project Name**, and a **Description**.',
                            '3. **Save**: Click "Save" to create the team card.'
                        ],
                        vi: [
                            '1. **Nhấp "+ Tạo Nhóm"**: Mở hộp thoại tạo mới.',
                            '2. **Điền Chi Tiết**: Nhập **Tên Nhóm**, **Tên Dự Án**, và **Mô Tả**.',
                            '3. **Lưu**: Nhấp "Lưu" để tạo thẻ nhóm.'
                        ],
                        ja: [
                            '1. **「+ チーム作成」をクリック**: 作成ダイアログを開きます。',
                            '2. **詳細を入力**: **チーム名**、**プロジェクト名**、**説明**を入力します。',
                            '3. **保存**: 「保存」をクリックしてチームカードを作成します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Edit Team', vi: 'Sửa Nhóm', ja: 'チーム編集' },
                    description: {
                        en: 'Update team information.',
                        vi: 'Cập nhật thông tin nhóm.',
                        ja: 'チーム情報を更新します。'
                    },
                    details: {
                        en: [
                            '1. **Locate Team Card**: Find the specific team in the list.',
                            '2. **Click Edit Icon**: Select the pencil icon in the top-right of the card.',
                            '3. **Modify & Save**: Update fields in the "Edit Team" dialog and save.'
                        ],
                        vi: [
                            '1. **Tìm Thẻ Nhóm**: Tìm nhóm cụ thể trong danh sách.',
                            '2. **Nhấp Biểu Tượng Sửa**: Chọn biểu tượng bút chì ở góc trên bên phải thẻ.',
                            '3. **Sửa Đổi & Lưu**: Cập nhật các trường trong hộp thoại "Sửa Nhóm" và lưu.'
                        ],
                        ja: [
                            '1. **チームカードを探す**: リストから特定のチームを見つけます。',
                            '2. **編集アイコンをクリック**: カード右上の鉛筆アイコンを選択します。',
                            '3. **変更と保存**: 「チーム編集」ダイアログのフィールドを更新して保存します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'members',
            tabTitle: { en: 'Team Members', vi: 'Thành Viên Nhóm', ja: 'チームメンバー' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Manage Members', vi: 'Quản Lý Thành Viên', ja: 'メンバー管理' },
                    description: {
                        en: 'View and manage team membership.',
                        vi: 'Xem và quản lý thành viên nhóm.',
                        ja: 'チームメンバーシップを表示および管理します。'
                    },
                    details: {
                        en: [
                            '1. **Click "Members"**: Located at the bottom of the team card.',
                            '2. **View List**: See current members and their roles within the team.'
                        ],
                        vi: [
                            '1. **Nhấp "Thành Viên"**: Nằm ở phía dưới thẻ nhóm.',
                            '2. **Xem Danh Sách**: Xem các thành viên hiện tại và vai trò của họ trong nhóm.'
                        ],
                        ja: [
                            '1. **「メンバー」をクリック**: チームカードの下部にあります。',
                            '2. **リストを表示**: 現在のメンバーとチーム内での役割を表示します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Add Member', vi: 'Thêm Thành Viên', ja: 'メンバー追加' },
                    description: {
                        en: 'Add new users to the team.',
                        vi: 'Thêm người dùng mới vào nhóm.',
                        ja: 'チームに新しいユーザーを追加します。'
                    },
                    details: {
                        en: [
                            '1. **Select User**: In the Members dialog, click the dropdown to find a user.',
                            '2. **Add**: Click the "+ Add" button to assign them to the team.',
                            '3. **Verify**: The user will appear in the member list below.'
                        ],
                        vi: [
                            '1. **Chọn Người Dùng**: Trong hộp thoại Thành viên, nhấp vào danh sách thả xuống để tìm người dùng.',
                            '2. **Thêm**: Nhấp nút "+ Thêm" để gán họ vào nhóm.',
                            '3. **Xác Nhận**: Người dùng sẽ xuất hiện trong danh sách thành viên bên dưới.'
                        ],
                        ja: [
                            '1. **ユーザーを選択**: メンバーダイアログで、ドロップダウンをクリックしてユーザーを見つけます。',
                            '2. **追加**: 「+ 追加」ボタンをクリックしてチームに割り当てます。',
                            '3. **確認**: 以下のメンバーリストにユーザーが表示されます。'
                        ]
                    }
                }
            ]
        }
    ]
};
