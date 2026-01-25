import { IFeatureGuideline } from './types';

export const broadcastGuideline: IFeatureGuideline = {
    featureId: 'broadcast',
    roleRequired: 'admin',
    overview: {
        en: 'Broadcast System Messages. Send announcements to all users or specific roles.',
        vi: 'Phát Tin Nhắn Hệ Thống. Gửi thông báo đến tất cả người dùng hoặc các vai trò cụ thể.',
        ja: '同報システムメッセージ。すべてのユーザーまたは特定の役割にお知らせを送信します。'
    },
    tabs: [
        {
            tabId: 'broadcast',
            tabTitle: { en: 'Broadcast Messages', vi: 'Tin Nhắn Hệ Thống', ja: '同報メッセージ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Send Announcement', vi: 'Gửi Thông Báo', ja: 'お知らせを送信' },
                    description: {
                        en: 'Create a new message to display on user screens.',
                        vi: 'Tạo tin nhắn mới để hiển thị trên màn hình người dùng.',
                        ja: 'ユーザー画面に表示する新しいメッセージを作成します。'
                    },
                    details: {
                        en: [
                            '1. Click "+ New Message" to start a broadcast.',
                            '2. Set the message type (e.g., Info, Warning, Error).',
                            '3. Choose the target audience (All Users, Leaders, etc.).',
                            '4. Enter the message content and schedule the send time.'
                        ],
                        vi: [
                            '1. Nhấp vào "+ Tin nhắn mới" để bắt đầu phát tin.',
                            '2. Đặt loại tin nhắn (ví dụ: Thông tin, Cảnh báo, Lỗi).',
                            '3. Chọn đối tượng mục tiêu (Tất cả người dùng, Trưởng nhóm, v.v.).',
                            '4. Nhập nội dung tin nhắn và lên lịch thời gian gửi.'
                        ],
                        ja: [
                            '1. 「+ 新しいメッセージ」をクリックして同報送信を開始します。',
                            '2. メッセージタイプを設定します（例：情報、警告、エラー）。',
                            '3. ターゲットオーディエンスを選択します（すべてのユーザー、リーダーなど）。',
                            '4. メッセージの内容を入力し、送信時間をスケジュールします。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Manage Messages', vi: 'Quản Lý Tin Nhắn', ja: 'メッセージ管理' },
                    description: {
                        en: 'Edit or remove active broadcasts.',
                        vi: 'Chỉnh sửa hoặc xóa các tin nhắn đang hoạt động.',
                        ja: 'アクティブな同報メッセージを編集または削除します。'
                    },
                    details: {
                        en: [
                            '1. View the list of active and past broadcasts.',
                            '2. Click "Edit" to modify an ongoing message.',
                            '3. Use "Delete" to retract a message immediately.'
                        ],
                        vi: [
                            '1. Xem danh sách các tin nhắn đang hoạt động và đã qua.',
                            '2. Nhấp vào "Chỉnh sửa" để sửa đổi tin nhắn đang diễn ra.',
                            '3. Sử dụng "Xóa" để thu hồi tin nhắn ngay lập tức.'
                        ],
                        ja: [
                            '1. アクティブおよび過去の同報送信のリストを表示します。',
                            '2. 「編集」をクリックして、進行中のメッセージを変更します。',
                            '3. 「削除」を使用して、メッセージを直ちに取り消します。'
                        ]
                    }
                }
            ]
        }
    ]
};
