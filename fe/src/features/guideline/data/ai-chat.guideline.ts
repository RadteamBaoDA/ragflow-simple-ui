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
                },
                {
                    id: 'step2',
                    title: { en: 'View Citations', vi: 'Xem Trích Dẫn', ja: '引用を表示' },
                    description: {
                        en: 'Hover over citation tags to see the source content.',
                        vi: 'Di chuột qua các thẻ trích dẫn để xem nội dung nguồn.',
                        ja: '引用タグにマウスを合わせると、ソースコンテンツが表示されます。'
                    },
                    details: {
                        en: [
                            '1. Locate citation tags like `<Fig. X>` within the AI response.',
                            '2. Hover your mouse over the tag to see a popup with the source text.',
                            '3. The popup shows the specific chunk retrieved from the Knowledge Base.'
                        ],
                        vi: [
                            '1. Tìm các thẻ trích dẫn như `<Fig. X>` trong câu trả lời của AI.',
                            '2. Di chuột qua thẻ để thấy cửa sổ hiện lên chứa nội dung nguồn.',
                            '3. Cửa sổ này hiển thị đoạn trích cụ thể được lấy từ Cơ sở Tri thức.'
                        ],
                        ja: [
                            '1. AIの回答内にある `<Fig. X>` などの引用タグを探します。',
                            '2. タグにマウスを合わせると、ソーステキストを含むポップアップが表示されます。',
                            '3. ポップアップには、ナレッジベースから取得された特定のチャンクが表示されます。'
                        ]
                    }
                },
                {
                    id: 'step3',
                    title: { en: 'Open Source Document', vi: 'Mở Tài Liệu Nguồn', ja: 'ソースドキュメントを開く' },
                    description: {
                        en: 'Access the full document for complete context.',
                        vi: 'Truy cập tài liệu đầy đủ để biết toàn bộ bối cảnh.',
                        ja: '完全なコンテキストを確認するために、ドキュメント全体にアクセスします。'
                    },
                    details: {
                        en: [
                            '1. While viewing the citation popup, look at the bottom area.',
                            '2. Click on the file name (e.g., "Master RAG.pdf").',
                            '3. The "Document Previewer" will open, displaying the full file.'
                        ],
                        vi: [
                            '1. Trong khi xem cửa sổ trích dẫn, hãy nhìn vào khu vực phía dưới.',
                            '2. Nhấp vào tên tệp (ví dụ: "Master RAG.pdf").',
                            '3. "Trình xem Tài liệu" sẽ mở ra, hiển thị toàn bộ tệp.'
                        ],
                        ja: [
                            '1. 引用ポップアップを表示している間、下部のエリアを確認します。',
                            '2. ファイル名（例：「Master RAG.pdf」）をクリックします。',
                            '3. 「ドキュメントプレビュー」が開き、ファイル全体が表示されます。'
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
            tabId: 'promptGuideline',
            tabTitle: { en: 'Prompt Guideline', vi: 'Hướng Dẫn Viết Prompt', ja: 'プロンプトガイドライン' },
            steps: [
                {
                    id: 'step1',
                    title: { en: 'Prompt Structure', vi: 'Cấu Trúc Prompt', ja: 'プロンプト構造' },
                    description: {
                        en: 'Learn the basic structure for effective prompts with knowledge base.',
                        vi: 'Tìm hiểu cấu trúc cơ bản cho các prompt hiệu quả với cơ sở tri thức.',
                        ja: 'ナレッジベースで効果的なプロンプトの基本構造を学びます。'
                    },
                    details: {
                        en: [
                            '**First Sentence: Guide the AI**',
                            '• Start with a clear instruction telling the AI what to do.',
                            '• Example: "Summarize the key points from the documents."',
                            '• Example: "Compare the information between these two sources."',
                            '',
                            '**Second Sentence: Your Query/Input**',
                            '• Provide your specific question or the content to process.',
                            '• Example: "What are the main differences between policy A and B?"',
                            '• Example: "Explain the process described in document X."'
                        ],
                        vi: [
                            '**Câu đầu tiên: Hướng dẫn AI**',
                            '• Bắt đầu bằng một chỉ dẫn rõ ràng cho AI biết phải làm gì.',
                            '• Ví dụ: "Tóm tắt các điểm chính từ các tài liệu."',
                            '• Ví dụ: "So sánh thông tin giữa hai nguồn này."',
                            '',
                            '**Câu thứ hai: Câu hỏi/Đầu vào của bạn**',
                            '• Cung cấp câu hỏi cụ thể hoặc nội dung cần xử lý.',
                            '• Ví dụ: "Sự khác biệt chính giữa chính sách A và B là gì?"',
                            '• Ví dụ: "Giải thích quy trình được mô tả trong tài liệu X."'
                        ],
                        ja: [
                            '**最初の文：AIへの指示**',
                            '• AIに何をすべきかを明確に指示することから始めます。',
                            '• 例：「ドキュメントから要点を要約してください。」',
                            '• 例：「これら2つのソース間の情報を比較してください。」',
                            '',
                            '**2番目の文：あなたのクエリ/入力**',
                            '• 具体的な質問または処理するコンテンツを提供します。',
                            '• 例：「ポリシーAとBの主な違いは何ですか？」',
                            '• 例：「ドキュメントXで説明されているプロセスを説明してください。」'
                        ]
                    }
                },
                {
                    id: 'step2',
                    title: { en: 'Best Practice Examples', vi: 'Ví Dụ Thực Hành Tốt', ja: 'ベストプラクティス例' },
                    description: {
                        en: 'Real-world examples of effective prompts for knowledge base queries.',
                        vi: 'Các ví dụ thực tế về prompt hiệu quả cho truy vấn cơ sở tri thức.',
                        ja: 'ナレッジベースクエリの効果的なプロンプトの実例。'
                    },
                    details: {
                        en: [
                            '**For Summarization:**',
                            '• "Based on the uploaded documents, provide a summary. Focus on the main objectives and key findings."',
                            '',
                            '**For Comparison:**',
                            '• "Compare and contrast the information. What are the similarities and differences between product X and Y?"',
                            '',
                            '**For Explanation:**',
                            '• "Using the knowledge base, explain in simple terms. How does the approval workflow function?"',
                            '',
                            '**For Analysis:**',
                            '• "Analyze the data from the documents. What trends can be identified in the quarterly reports?"'
                        ],
                        vi: [
                            '**Để Tóm Tắt:**',
                            '• "Dựa trên các tài liệu đã tải lên, cung cấp bản tóm tắt. Tập trung vào các mục tiêu chính và phát hiện quan trọng."',
                            '',
                            '**Để So Sánh:**',
                            '• "So sánh và đối chiếu thông tin. Điểm giống và khác nhau giữa sản phẩm X và Y là gì?"',
                            '',
                            '**Để Giải Thích:**',
                            '• "Sử dụng cơ sở tri thức, giải thích một cách đơn giản. Quy trình phê duyệt hoạt động như thế nào?"',
                            '',
                            '**Để Phân Tích:**',
                            '• "Phân tích dữ liệu từ các tài liệu. Có thể nhận ra xu hướng nào trong các báo cáo hàng quý?"'
                        ],
                        ja: [
                            '**要約の場合：**',
                            '• 「アップロードされたドキュメントに基づいて要約を提供してください。主な目的と重要な発見に焦点を当ててください。」',
                            '',
                            '**比較の場合：**',
                            '• 「情報を比較対照してください。製品XとYの類似点と相違点は何ですか？」',
                            '',
                            '**説明の場合：**',
                            '• 「ナレッジベースを使用して、簡単な言葉で説明してください。承認ワークフローはどのように機能しますか？」',
                            '',
                            '**分析の場合：**',
                            '• 「ドキュメントからデータを分析してください。四半期報告書でどのような傾向が特定できますか？」'
                        ]
                    }
                },
                {
                    id: 'step3',
                    title: { en: 'Tips for Qwen3', vi: 'Mẹo Cho Qwen3', ja: 'Qwen3のヒント' },
                    description: {
                        en: 'Optimize your prompts specifically for Qwen3 model.',
                        vi: 'Tối ưu hóa prompt của bạn đặc biệt cho mô hình Qwen3.',
                        ja: 'Qwen3モデル向けにプロンプトを最適化します。'
                    },
                    details: {
                        en: [
                            '**Be Specific:**',
                            '• Clearly state the task type (summarize, compare, explain, analyze).',
                            '• Specify the scope and depth of the response you expect.',
                            '',
                            '**Use Context Keywords:**',
                            '• Include phrases like "based on the documents", "from the knowledge base".',
                            '• This helps Qwen3 prioritize knowledge base content over general knowledge.',
                            '',
                            '**Structure Your Request:**',
                            '• For complex queries, break them into numbered steps.',
                            '• Example: "1. Find relevant sections about X. 2. Summarize each section. 3. Compare the findings."',
                            '',
                            '**Avoid Vague Questions:**',
                            '• ❌ "Tell me about this"',
                            '• ✅ "Explain the main features of the product described in the uploaded manual."'
                        ],
                        vi: [
                            '**Cụ Thể:**',
                            '• Nêu rõ loại nhiệm vụ (tóm tắt, so sánh, giải thích, phân tích).',
                            '• Chỉ định phạm vi và độ sâu của phản hồi bạn mong đợi.',
                            '',
                            '**Sử Dụng Từ Khóa Ngữ Cảnh:**',
                            '• Bao gồm các cụm từ như "dựa trên các tài liệu", "từ cơ sở tri thức".',
                            '• Điều này giúp Qwen3 ưu tiên nội dung cơ sở tri thức hơn kiến thức chung.',
                            '',
                            '**Cấu Trúc Yêu Cầu:**',
                            '• Đối với các truy vấn phức tạp, chia chúng thành các bước được đánh số.',
                            '• Ví dụ: "1. Tìm các phần liên quan về X. 2. Tóm tắt từng phần. 3. So sánh các phát hiện."',
                            '',
                            '**Tránh Câu Hỏi Mơ Hồ:**',
                            '• ❌ "Cho tôi biết về cái này"',
                            '• ✅ "Giải thích các tính năng chính của sản phẩm được mô tả trong hướng dẫn sử dụng đã tải lên."'
                        ],
                        ja: [
                            '**具体的に：**',
                            '• タスクの種類（要約、比較、説明、分析）を明確に述べてください。',
                            '• 期待する回答の範囲と深さを指定してください。',
                            '',
                            '**コンテキストキーワードを使用：**',
                            '• 「ドキュメントに基づいて」、「ナレッジベースから」などのフレーズを含めてください。',
                            '• これにより、Qwen3は一般的な知識よりもナレッジベースのコンテンツを優先します。',
                            '',
                            '**リクエストを構造化：**',
                            '• 複雑なクエリの場合は、番号付きのステップに分割してください。',
                            '• 例：「1. Xに関する関連セクションを見つける。2. 各セクションを要約する。3. 発見を比較する。」',
                            '',
                            '**あいまいな質問を避ける：**',
                            '• ❌ 「これについて教えて」',
                            '• ✅ 「アップロードされたマニュアルに記載されている製品の主な機能を説明してください。」'
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
                        en: 'Filter sessions by date range using date pickers.',
                        vi: 'Lọc các phiên theo phạm vi ngày bằng bộ chọn ngày.',
                        ja: '日付ピッカーを使用して日付範囲でセッションをフィルタリングします。'
                    },
                    details: {
                        en: [
                            '1. Click the filter icon next to the search bar to open the "Filter History" dialog.',
                            '2. **Start Date**: Click the date picker and select the beginning date of your range.',
                            '3. **End Date**: Click the date picker and select the ending date of your range.',
                            '4. Click **"Apply Filters"** to filter the history list by the selected date range.',
                            '5. Click **"Reset"** to clear all date filters and show all history.'
                        ],
                        vi: [
                            '1. Nhấp vào biểu tượng bộ lọc bên cạnh thanh tìm kiếm để mở hộp thoại "Lọc Lịch Sử".',
                            '2. **Ngày Bắt Đầu**: Nhấp vào bộ chọn ngày và chọn ngày bắt đầu của phạm vi.',
                            '3. **Ngày Kết Thúc**: Nhấp vào bộ chọn ngày và chọn ngày kết thúc của phạm vi.',
                            '4. Nhấp **"Áp Dụng Bộ Lọc"** để lọc danh sách lịch sử theo phạm vi ngày đã chọn.',
                            '5. Nhấp **"Đặt Lại"** để xóa tất cả bộ lọc ngày và hiển thị toàn bộ lịch sử.'
                        ],
                        ja: [
                            '1. 検索バーの横にあるフィルタアイコンをクリックして「履歴をフィルタ」ダイアログを開きます。',
                            '2. **開始日**: 日付ピッカーをクリックして、範囲の開始日を選択します。',
                            '3. **終了日**: 日付ピッカーをクリックして、範囲の終了日を選択します。',
                            '4. **「フィルタを適用」** をクリックして、選択した日付範囲で履歴リストをフィルタリングします。',
                            '5. **「リセット」** をクリックして、すべての日付フィルタをクリアし、すべての履歴を表示します。'
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
