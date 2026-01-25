import { IFeatureGuideline } from './types';

export const aiChatGuideline: IFeatureGuideline = {
    featureId: 'ai-chat',
    roleRequired: 'user',
    overview: {
        en: 'Learn how to use the AI Chat assistant for your daily tasks. Select specialized agents, use prompt templates, and manage your conversation history effectively.',
        vi: 'Tìm hiểu cách sử dụng trợ lý AI Chat cho các công việc hàng ngày của bạn. Chọn các tác nhân chuyên biệt, sử dụng mẫu gợi ý và quản lý lịch sử trò chuyện hiệu quả.',
        ja: '日々のタスクにAIチャットアシスタントを活用する方法を学びます。専門のエージェントを選択し、プロンプトテンプレートを使用し、会話履歴を効果的に管理します。'
    },
    tabs: [
        {
            tabId: 'basicChatting',
            tabTitle: { en: 'Basic Chatting', vi: 'Trò Chuyện Cơ Bản', ja: '基本チャット' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Send a Message', vi: 'Gửi Tin Nhắn', ja: 'メッセージを送信' },
                    description: {
                        en: 'Start a conversation with the AI.',
                        vi: 'Bắt đầu cuộc trò chuyện với AI.',
                        ja: 'AIとの会話を開始します。'
                    },
                    details: {
                        en: [
                            '1. Type your question or command in the input box at the bottom.',
                            '2. Press Enter or click the "Send" icon (paper plane).',
                            '3. Wait for the AI to process and stream the response.'
                        ],
                        vi: [
                            '1. Nhập câu hỏi hoặc lệnh của bạn vào ô nhập liệu ở dưới cùng.',
                            '2. Nhấn Enter hoặc nhấp vào biểu tượng "Gửi" (máy bay giấy).',
                            '3. Đợi AI xử lý và truyền phát câu trả lời.'
                        ],
                        ja: [
                            '1. 下部の入力ボックスに質問またはコマンドを入力します。',
                            '2. Enterキーを押すか、「送信」アイコン（紙飛行機）をクリックします。',
                            '3. AIが処理して応答をストリーミングするのを待ちます。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'agentSelection',
            tabTitle: { en: 'Agent Selection', vi: 'Chọn Trợ Lý', ja: 'エージェント選択' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Select an Agent', vi: 'Chọn một Trợ lý', ja: 'エージェントを選択' },
                    description: {
                        en: 'Choose from a list of specialized agents tailored for different tasks.',
                        vi: 'Chọn từ danh sách các trợ lý chuyên biệt được thiết kế cho các nhiệm vụ khác nhau.',
                        ja: 'さまざまなタスクに合わせて調整された専門エージェントのリストから選択します。'
                    },
                    details: {
                        en: [
                            '1. Click on the Agent Selector dropdown in the top header.',
                            '2. Browse the list of available agents (e.g., General Assistant, Code Expert).',
                            '3. Select the agent that best fits your current task.'
                        ],
                        vi: [
                            '1. Nhấp vào danh sách thả xuống Chọn Trợ lý ở tiêu đề trên cùng.',
                            '2. Duyệt qua danh sách các trợ lý có sẵn (ví dụ: Trợ lý chung, Chuyên gia mã).',
                            '3. Chọn trợ lý phù hợp nhất với nhiệm vụ hiện tại của bạn.'
                        ],
                        ja: [
                            '1. トップヘッダーのエージェント選択ドロップダウンをクリックします。',
                            '2. 利用可能なエージェントのリストを参照します（例：一般アシスタント、コードエキスパート）。',
                            '3. 現在のタスクに最適なエージェントを選択します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'promptLibrary',
            tabTitle: { en: 'Prompt Library', vi: 'Thư Viện Gợi Ý', ja: 'プロンプトライブラリ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Use Templates', vi: 'Sử dụng Mẫu', ja: 'テンプレートを使用' },
                    description: {
                        en: 'Access pre-defined prompts to get better results quickly.',
                        vi: 'Truy cập các gợi ý được định nghĩa trước để có kết quả tốt hơn nhanh chóng.',
                        ja: '事前に定義されたプロンプトにアクセスして、より良い結果を迅速に得ることができます。'
                    },
                    details: {
                        en: [
                            '1. Click the "Prompt Library" icon near the chat input.',
                            '2. Search or browse for a relevant prompt template.',
                            '3. Click on a template to insert it into your message box.',
                            '4. Modify the template variables as needed before sending.'
                        ],
                        vi: [
                            '1. Nhấp vào biểu tượng "Thư viện gợi ý" gần khung nhập chat.',
                            '2. Tìm kiếm hoặc duyệt qua các mẫu gợi ý liên quan.',
                            '3. Nhấp vào một mẫu để chèn nó vào hộp tin nhắn của bạn.',
                            '4. Sửa đổi các biến mẫu nếu cần trước khi gửi.'
                        ],
                        ja: [
                            '1. チャット入力近くの「プロンプトライブラリ」アイコンをクリックします。',
                            '2. 関連するプロンプトテンプレートを検索または参照します。',
                            '3. テンプレートをクリックしてメッセージボックスに挿入します。',
                            '4. 送信する前に、必要に応じてテンプレート変数を変更します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'responseFeedback',
            tabTitle: { en: 'Feedback', vi: 'Phản Hồi', ja: 'フィードバック' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Rate Response', vi: 'Đánh Giá', ja: '回答を評価' },
                    description: {
                        en: 'Rate the quality of the AI response.',
                        vi: 'Đánh giá chất lượng câu trả lời của AI.',
                        ja: 'AIの回答の品質を評価します。'
                    },
                    details: {
                        en: [
                            '1. Hover over an AI message to see the action buttons.',
                            '2. Click the "Like" (Thumbs Up) icon if the answer was helpful.',
                            '3. Click the "Dislike" (Thumbs Down) icon if the answer was incorrect or poor.'
                        ],
                        vi: [
                            '1. Di chuột qua tin nhắn của AI để xem các nút hành động.',
                            '2. Nhấp vào biểu tượng "Thích" (Ngón tay cái lên) nếu câu trả lời hữu ích.',
                            '3. Nhấp vào biểu tượng "Không thích" (Ngón tay cái xuống) nếu câu trả lời sai hoặc kém.'
                        ],
                        ja: [
                            '1. AIメッセージにマウスを合わせると、アクションボタンが表示されます。',
                            '2. 回答が役に立った場合は、「いいね」（親指を上げる）アイコンをクリックします。',
                            '3. 回答が間違っていたり不十分だったりした場合は、「よくないね」（親指を下げる）アイコンをクリックします。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Submit Comment', vi: 'Gửi Nhận Xét', ja: 'コメントを送信' },
                    description: {
                        en: 'Provide details when disliking a response.',
                        vi: 'Cung cấp chi tiết khi không thích câu trả lời.',
                        ja: '回答が気に入らない場合に詳細を提供します。'
                    },
                    details: {
                        en: [
                            '1. When you click "Dislike", a feedback dialog will appear.',
                            '2. Explain why the response was not satisfactory (e.g., Inaccurate, Harmful).',
                            '3. Click "Submit" to send your feedback to the development team.'
                        ],
                        vi: [
                            '1. Khi bạn nhấp vào "Không thích", hộp thoại phản hồi sẽ xuất hiện.',
                            '2. Giải thích lý do tại sao câu trả lời không thỏa đáng (ví dụ: Không chính xác, Có hại).',
                            '3. Nhấp vào "Gửi" để gửi phản hồi của bạn đến nhóm phát triển.'
                        ],
                        ja: [
                            '1. 「よくないね」をクリックすると、フィードバックダイアログが表示されます。',
                            '2. 回答が不十分であった理由（例：不正確、有害）を説明します。',
                            '3. 「送信」をクリックして、フィードバックを開発チームに送信します。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'actionBar',
            tabTitle: { en: 'Action Bar', vi: 'Thanh Thao Tác', ja: 'アクションバー' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Chat Controls', vi: 'Điều khiển Chat', ja: 'チャットコントロール' },
                    description: {
                        en: 'Zoom, reset session, or clear history using the action bar.',
                        vi: 'Phóng to, đặt lại phiên hoặc xóa lịch sử bằng thanh thao tác.',
                        ja: 'アクションバーを使用して、ズーム、セッションのリセット、または履歴の消去を行います。'
                    },
                    details: {
                        en: [
                            '1. Look for the action icons in the top-right corner.',
                            '2. Use "New Chat" to start a fresh session context.',
                            '3. Use "Clear History" to remove all past messages.',
                            '4. Other icons may provide zooming or settings options.'
                        ],
                        vi: [
                            '1. Tìm các biểu tượng thao tác ở góc trên bên phải.',
                            '2. Sử dụng "Chat mới" để bắt đầu bối cảnh phiên mới.',
                            '3. Sử dụng "Xóa lịch sử" để xóa tất cả tin nhắn cũ.',
                            '4. Các biểu tượng khác có thể cung cấp tùy chọn phóng to hoặc cài đặt.'
                        ],
                        ja: [
                            '1. 右上のアクションアイコンを探します。',
                            '2. 「新しいチャット」を使用して、新しいセッションコンテキストを開始します。',
                            '3. 「履歴を消去」を使用して、過去のすべてのメッセージを削除します。',
                            '4. その他のアイコンには、ズームや設定オプションがある場合があります。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'history',
            tabTitle: { en: 'History Management', vi: 'Quản Lý Lịch Sử', ja: '履歴管理' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'View Past Chats', vi: 'Xem Chat Cũ', ja: '過去のチャットを表示' },
                    description: {
                        en: 'Access your previous conversations from the sidebar.',
                        vi: 'Truy cập các cuộc trò chuyện trước đây của bạn từ thanh bên.',
                        ja: 'サイドバーから過去の会話にアクセスします。'
                    },
                    details: {
                        en: [
                            '1. Open the left sidebar if it is collapsed.',
                            '2. Click on "Chat History" to view a list of past sessions.',
                            '3. Click on any session to load the conversation context.'
                        ],
                        vi: [
                            '1. Mở thanh bên trái nếu nó đang bị thu nhỏ.',
                            '2. Nhấp vào "Lịch sử Chat" để xem danh sách các phiên cũ.',
                            '3. Nhấp vào bất kỳ phiên nào để tải bối cảnh cuộc trò chuyện.'
                        ],
                        ja: [
                            '1. 左側のサイドバーが折りたたまれている場合は開きます。',
                            '2. 「チャット履歴」をクリックして、過去のセッションのリストを表示します。',
                            '3. 任意のセッションをクリックして、会話コンテキストを読み込みます。'
                        ]
                    }
                }
            ]
        },
        {
            tabId: 'historySearch',
            tabTitle: { en: 'Search & Filter', vi: 'Tìm Kiếm & Lọc', ja: '検索とフィルタ' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Search History', vi: 'Tìm Kiếm Lịch Sử', ja: '履歴を検索' },
                    description: {
                        en: 'Search through your chat history by keywords.',
                        vi: 'Tìm kiếm qua lịch sử trò chuyện của bạn bằng từ khóa.',
                        ja: 'キーワードでチャット履歴を検索します。'
                    },
                    details: {
                        en: [
                            '1. In the History sidebar, locate the search bar at the top.',
                            '2. Type keywords related to the conversation you want to find.',
                            '3. Press Enter or wait for the results to filter automatically.'
                        ],
                        vi: [
                            '1. Trong thanh bên Lịch sử, tìm thanh tìm kiếm ở trên cùng.',
                            '2. Nhập từ khóa liên quan đến cuộc trò chuyện bạn muốn tìm.',
                            '3. Nhấn Enter hoặc đợi kết quả tự động lọc.'
                        ],
                        ja: [
                            '1. 履歴サイドバーの上部にある検索バーを見つけます。',
                            '2. 見つけたい会話に関連するキーワードを入力します。',
                            '3. Enterを押すか、結果が自動的にフィルタリングされるのを待ちます。'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Filter Options', vi: 'Tùy Chọn Lọc', ja: 'フィルタオプション' },
                    description: {
                        en: 'Filter sessions by date range or other criteria.',
                        vi: 'Lọc các phiên theo phạm vi ngày hoặc các tiêu chí khác.',
                        ja: '日付範囲やその他の基準でセッションをフィルタリングします。'
                    },
                    details: {
                        en: [
                            '1. Click the filter icon next to the search bar.',
                            '2. Select a date range (e.g., Last 7 days, Last month).',
                            '3. Apply filters to narrow down the history list.'
                        ],
                        vi: [
                            '1. Nhấp vào biểu tượng bộ lọc bên cạnh thanh tìm kiếm.',
                            '2. Chọn phạm vi ngày (ví dụ: 7 ngày qua, Tháng trước).',
                            '3. Áp dụng bộ lọc để thu hẹp danh sách lịch sử.'
                        ],
                        ja: [
                            '1. 検索バーの横にあるフィルタアイコンをクリックします。',
                            '2. 日付範囲を選択します（例：過去7日間、先月）。',
                            '3. フィルタを適用して履歴リストを絞り込みます。'
                        ]
                    }
                }
            ]
        }
    ],
    tourSteps: [
        {
            target: '#agent-selector',
            content: { en: 'Select your AI agent here.', vi: 'Chọn trợ lý AI của bạn tại đây.', ja: 'ここでAIエージェントを選択します。' }
        },
        {
            target: '#prompt-library-btn',
            content: { en: 'Open prompt library.', vi: 'Mở thư viện gợi ý.', ja: 'プロンプトライブラリを開く。' }
        }
    ]
};
