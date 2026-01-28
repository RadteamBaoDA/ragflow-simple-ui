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
            tabId: 'create',
            tabTitle: { en: 'Create Broadcast', vi: 'Tạo Thông Báo', ja: '一斉送信の作成' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Message & Schedule', vi: 'Tin Nhắn & Lịch Trình', ja: 'メッセージとスケジュール' },
                    description: {
                        en: 'Define the content and timing of the announcement.',
                        vi: 'Xác định nội dung và thời gian của thông báo.',
                        ja: 'お知らせの内容とタイミングを定義します。'
                    },
                    details: {
                        en: [
                            '1. **Message**: Enter the full text of your announcement (up to 2000 characters).',
                            '2. **Start Date**: Use the calendar picker to select when the message should appear.',
                            '3. **End Date**: Use the calendar picker to select when the message should automatically expire.'
                        ],
                        vi: [
                            '1. **Tin Nhắn**: Nhập toàn bộ nội dung thông báo của bạn (tối đa 2000 ký tự).',
                            '2. **Ngày Bắt Đầu**: Sử dụng bộ chọn lịch để chọn thời điểm tin nhắn xuất hiện.',
                            '3. **Ngày Kết Thúc**: Sử dụng bộ chọn lịch để chọn thời điểm tin nhắn tự động hết hạn.'
                        ],
                        ja: [
                            '1. **メッセージ**: お知らせの全文を入力します（最大2000文字）。',
                            '2. **開始日**: カレンダーピッカーを使用して、メッセージが表示される日時を選択します。',
                            '3. **終了日**: カレンダーピッカーを使用して、メッセージが自動的に期限切れになる日時を選択します。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Appearance & Behavior', vi: 'Giao Diện & Hành Vi', ja: '外観と動作' },
                    description: {
                        en: 'Customize colors and interaction options.',
                        vi: 'Tùy chỉnh màu sắc và các tùy chọn tương tác.',
                        ja: '色と対話オプションをカスタマイズします。'
                    },
                    details: {
                        en: [
                            '1. **Background & Font Color**: Use the color pickers to specific hex codes (e.g., #4043E7).',
                            '2. **Active Checkbox**: Check this to make the broadcast live immediately (within date range).',
                            '3. **Dismissible Checkbox**: If checked, users will see an "X" button to close the banner manually. If unchecked, the banner remains visible until it expires.'
                        ],
                        vi: [
                            '1. **Màu Nền & Phông Chữ**: Sử dụng bộ chọn màu để xác định mã hex cụ thể (ví dụ: #4043E7).',
                            '2. **Hộp Kiểm Hoạt Động**: Chọn ô này để phát tin nhắn ngay lập tức (trong khoảng thời gian đã chọn).',
                            '3. **Hộp Kiểm Có Thể Tắt**: Nếu được chọn, người dùng sẽ thấy nút "X" để đóng biểu ngữ thủ công. Nếu không chọn, biểu ngữ sẽ hiển thị cho đến khi hết hạn.'
                        ],
                        ja: [
                            '1. **背景とフォントの色**: カラーピッカーを使用して、特定の16進コード（例：#4043E7）を指定します。',
                            '2. **アクティブチェックボックス**: これをチェックすると、一斉送信がすぐに（日付範囲内で）有効になります。',
                            '3. **却下可能チェックボックス**: チェックした場合、ユーザーは「X」ボタンでバナーを手動で閉じることができます。チェックしない場合、バナーは期限切れになるまで表示されたままになります。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'manage',
            tabTitle: { en: 'Manage Broadcasts', vi: 'Quản Lý Thông Báo', ja: '一斉送信の管理' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Message List & Actions', vi: 'Danh Sách & Thao Tác', ja: 'メッセージリストとアクション' },
                    description: {
                        en: 'Review and manage existing broadcasts.',
                        vi: 'Xem lại và quản lý các thông báo hiện có.',
                        ja: '既存の一斉送信を確認および管理します。'
                    },
                    details: {
                        en: [
                            '1. **Data Table**: View "Message", "Period" (Date Range), and "Status" (Active/Inactive) at a glance.',
                            '2. **Edit (Pencil Icon)**: Click to modify the message text, dates, or active status.',
                            '3. **Delete (Trash Icon)**: Click to permanently remove the broadcast message.'
                        ],
                        vi: [
                            '1. **Bảng Dữ Liệu**: Xem nhanh "Tin Nhắn", "Giai Đoạn" (Khoảng thời gian) và "Trạng Thái" (Hoạt động/Không hoạt động).',
                            '2. **Sửa (Biểu Tượng Bút Chì)**: Nhấp để sửa đổi nội dung tin nhắn, ngày tháng hoặc trạng thái hoạt động.',
                            '3. **Xóa (Biểu Tượng Thùng Rác)**: Nhấp để xóa vĩnh viễn tin nhắn thông báo.'
                        ],
                        ja: [
                            '1. **データテーブル**: 「メッセージ」、「期間」（日付範囲）、「ステータス」（アクティブ/非アクティブ）を一目で確認できます。',
                            '2. **編集（鉛筆アイコン）**: クリックして、メッセージテキスト、日付、またはアクティブステータスを変更します。',
                            '3. **削除（ゴミ箱アイコン）**: クリックして、一斉送信メッセージを完全に削除します。'
                        ]
                    }
                }
            ]
        }
    ]
};
