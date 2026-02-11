/**
 * Generate sample Excel file for glossary bulk import.
 * 100 tasks × ~30 keywords each = ~3000 keywords
 * Keywords are in Japanese with English translations.
 * Optimized for RAG Document Q&A specification.
 */
const XLSX = require('xlsx')
const path = require('path')

// ===========================================================================
// Task definitions — 100 RAG Document Q&A related tasks
// ===========================================================================
const tasks = [
  { name: '文書検索精度向上', instruction: 'ドキュメント検索の精度を改善するための用語を使用してください', template: '以下の{keyword}に関する情報を検索し、正確な回答を生成してください' },
  { name: 'FAQ自動生成', instruction: 'よくある質問と回答のペアを自動生成するための用語', template: '{keyword}に関するFAQを生成してください' },
  { name: 'ナレッジベース構築', instruction: 'ナレッジベースの構造化に使用する用語', template: '{keyword}のナレッジベースエントリを作成してください' },
  { name: 'セマンティック検索最適化', instruction: '意味検索の精度向上のための用語定義', template: '{keyword}の意味的関連性を考慮した検索を実行してください' },
  { name: 'チャンク分割戦略', instruction: 'ドキュメントの効果的な分割方法に関する用語', template: '{keyword}に基づいてドキュメントを適切にチャンク分割してください' },
  { name: 'エンベディング最適化', instruction: 'ベクトル埋め込みの品質向上のための用語', template: '{keyword}のエンベディングを最適化してください' },
  { name: 'コンテキストウィンドウ管理', instruction: 'LLMのコンテキスト管理に関する用語', template: '{keyword}を含むコンテキストウィンドウを管理してください' },
  { name: 'プロンプトエンジニアリング', instruction: 'プロンプト設計の最適化用語', template: '{keyword}を考慮したプロンプトを設計してください' },
  { name: '回答品質評価', instruction: '回答の品質を評価するための基準用語', template: '{keyword}の基準に基づいて回答品質を評価してください' },
  { name: 'ハルシネーション防止', instruction: 'AIの幻覚を防止するための用語', template: '{keyword}に関してハルシネーションを防止する回答を生成してください' },
  { name: 'メタデータ抽出', instruction: 'ドキュメントメタデータの抽出用語', template: '{keyword}のメタデータを抽出してください' },
  { name: 'マルチモーダル検索', instruction: '複数のモダリティにまたがる検索用語', template: '{keyword}に関するマルチモーダル検索を実行してください' },
  { name: '文書要約生成', instruction: 'ドキュメント要約の生成用語', template: '{keyword}に関する文書の要約を生成してください' },
  { name: 'エンティティ認識', instruction: '固有表現認識に関する用語', template: '{keyword}のエンティティを認識し抽出してください' },
  { name: '関連性スコアリング', instruction: '検索結果の関連性評価用語', template: '{keyword}の関連性スコアを計算してください' },
  { name: 'クエリ拡張', instruction: '検索クエリの拡張技術用語', template: '{keyword}を使用してクエリを拡張してください' },
  { name: 'ドキュメント分類', instruction: 'ドキュメントの自動分類用語', template: '{keyword}に基づいてドキュメントを分類してください' },
  { name: '知識グラフ構築', instruction: '知識グラフの構築に関する用語', template: '{keyword}の知識グラフを構築してください' },
  { name: 'リトリーバル評価', instruction: '検索性能の評価指標用語', template: '{keyword}のリトリーバル性能を評価してください' },
  { name: 'ファインチューニング', instruction: 'モデルの微調整に関する用語', template: '{keyword}に特化したファインチューニングを実行してください' },
  { name: 'データクレンジング', instruction: 'データ品質向上のための用語', template: '{keyword}のデータをクレンジングしてください' },
  { name: 'OCR精度向上', instruction: 'OCR読み取り精度に関する用語', template: '{keyword}のOCR精度を向上させてください' },
  { name: 'テーブル抽出', instruction: '表データの抽出に関する用語', template: '{keyword}の表データを正確に抽出してください' },
  { name: 'PDF解析最適化', instruction: 'PDF解析の最適化用語', template: '{keyword}を含むPDFを最適に解析してください' },
  { name: '多言語対応', instruction: '多言語処理に関する用語', template: '{keyword}の多言語対応を実装してください' },
  { name: 'トークン最適化', instruction: 'トークン使用量の最適化用語', template: '{keyword}のトークン使用を最適化してください' },
  { name: 'キャッシュ戦略', instruction: '検索結果キャッシュの用語', template: '{keyword}の検索結果をキャッシュしてください' },
  { name: 'ストリーミング応答', instruction: 'ストリーミング配信の用語', template: '{keyword}に関する回答をストリーミング配信してください' },
  { name: 'バッチ処理最適化', instruction: 'バッチ処理の効率化用語', template: '{keyword}のバッチ処理を最適化してください' },
  { name: '権限管理', instruction: 'アクセス制御に関する用語', template: '{keyword}の権限管理を設定してください' },
  { name: 'バージョン管理', instruction: 'ドキュメントバージョン管理用語', template: '{keyword}のバージョン管理を実装してください' },
  { name: 'インデックス最適化', instruction: '検索インデックスの最適化用語', template: '{keyword}のインデックスを最適化してください' },
  { name: 'フィルタリング戦略', instruction: '検索フィルタの設計用語', template: '{keyword}に基づくフィルタリングを適用してください' },
  { name: 'リランキング', instruction: '検索結果の再順位付け用語', template: '{keyword}の検索結果をリランキングしてください' },
  { name: 'ハイブリッド検索', instruction: 'ハイブリッド検索手法の用語', template: '{keyword}のハイブリッド検索を実行してください' },
  { name: 'クロスエンコーダー', instruction: 'クロスエンコーダーモデルの用語', template: '{keyword}のクロスエンコーダースコアを計算してください' },
  { name: 'データパイプライン', instruction: 'データ処理パイプラインの用語', template: '{keyword}のデータパイプラインを構築してください' },
  { name: 'エラーハンドリング', instruction: 'エラー処理に関する用語', template: '{keyword}のエラーハンドリングを実装してください' },
  { name: 'ログ分析', instruction: 'ログデータの分析用語', template: '{keyword}のログデータを分析してください' },
  { name: 'パフォーマンス監視', instruction: 'システム性能監視の用語', template: '{keyword}のパフォーマンスを監視してください' },
  { name: 'スケーラビリティ', instruction: 'システム拡張性に関する用語', template: '{keyword}のスケーラビリティを確保してください' },
  { name: 'セキュリティ対策', instruction: 'セキュリティに関する用語', template: '{keyword}のセキュリティ対策を実施してください' },
  { name: 'データ暗号化', instruction: 'データ暗号化に関する用語', template: '{keyword}のデータを暗号化してください' },
  { name: 'API設計', instruction: 'API設計に関する用語', template: '{keyword}のAPIを設計してください' },
  { name: 'ウェブクローリング', instruction: 'ウェブスクレイピングの用語', template: '{keyword}のウェブページをクローリングしてください' },
  { name: 'テキスト前処理', instruction: 'テキスト前処理の用語', template: '{keyword}のテキストを前処理してください' },
  { name: '形態素解析', instruction: '日本語形態素解析の用語', template: '{keyword}の形態素解析を実行してください' },
  { name: '感情分析', instruction: '感情分析に関する用語', template: '{keyword}の感情分析を実行してください' },
  { name: 'トピックモデリング', instruction: 'トピック抽出の用語', template: '{keyword}のトピックモデリングを実行してください' },
  { name: '文書類似度', instruction: '文書間の類似度計算用語', template: '{keyword}の文書類似度を計算してください' },
  { name: 'クラスタリング', instruction: 'データクラスタリングの用語', template: '{keyword}のクラスタリングを実行してください' },
  { name: 'アノテーション', instruction: 'データラベリングの用語', template: '{keyword}のアノテーションを実施してください' },
  { name: '品質保証', instruction: '品質管理に関する用語', template: '{keyword}の品質保証を実施してください' },
  { name: 'ユーザーフィードバック', instruction: 'ユーザーフィードバック処理の用語', template: '{keyword}のユーザーフィードバックを分析してください' },
  { name: 'A/Bテスト', instruction: 'A/Bテスト設計の用語', template: '{keyword}のA/Bテストを実施してください' },
  { name: '負荷テスト', instruction: '負荷テストに関する用語', template: '{keyword}の負荷テストを実行してください' },
  { name: '回帰テスト', instruction: '回帰テストの用語', template: '{keyword}の回帰テストを実施してください' },
  { name: 'CI/CD パイプライン', instruction: 'CI/CDに関する用語', template: '{keyword}のCI/CDパイプラインを設定してください' },
  { name: 'コンテナ化', instruction: 'コンテナ技術の用語', template: '{keyword}をコンテナ化してください' },
  { name: 'マイクロサービス', instruction: 'マイクロサービスの用語', template: '{keyword}のマイクロサービスを設計してください' },
  { name: 'イベント駆動設計', instruction: 'イベント駆動アーキテクチャの用語', template: '{keyword}のイベント駆動設計を実装してください' },
  { name: 'メッセージキュー', instruction: 'メッセージングシステムの用語', template: '{keyword}のメッセージキューを設定してください' },
  { name: 'データレイク', instruction: 'データレイク構築の用語', template: '{keyword}のデータレイクを構築してください' },
  { name: 'ETLプロセス', instruction: 'ETL処理の用語', template: '{keyword}のETLプロセスを設計してください' },
  { name: 'リアルタイム処理', instruction: 'リアルタイム処理の用語', template: '{keyword}のリアルタイム処理を実装してください' },
  { name: 'データガバナンス', instruction: 'データガバナンスの用語', template: '{keyword}のデータガバナンスを実施してください' },
  { name: 'コンプライアンス', instruction: 'コンプライアンス管理の用語', template: '{keyword}のコンプライアンスを確認してください' },
  { name: '監査ログ', instruction: '監査ログの用語', template: '{keyword}の監査ログを設定してください' },
  { name: 'データリネージ', instruction: 'データ系統追跡の用語', template: '{keyword}のデータリネージを追跡してください' },
  { name: 'フェデレーテッド検索', instruction: '分散検索の用語', template: '{keyword}のフェデレーテッド検索を実行してください' },
  { name: 'グラフデータベース', instruction: 'グラフDBの用語', template: '{keyword}のグラフデータベースを構築してください' },
  { name: 'ベクトルデータベース', instruction: 'ベクトルDBの用語', template: '{keyword}のベクトルデータベースを最適化してください' },
  { name: '全文検索エンジン', instruction: '全文検索の用語', template: '{keyword}の全文検索を設定してください' },
  { name: 'クエリ理解', instruction: 'クエリ意図の理解用語', template: '{keyword}のクエリ意図を理解してください' },
  { name: '対話管理', instruction: '対話フローの管理用語', template: '{keyword}の対話フローを管理してください' },
  { name: 'コンテキスト保持', instruction: '会話コンテキスト管理の用語', template: '{keyword}のコンテキストを保持してください' },
  { name: 'マルチターン対話', instruction: 'マルチターン会話の用語', template: '{keyword}のマルチターン対話を設計してください' },
  { name: '回答生成戦略', instruction: '回答生成の戦略用語', template: '{keyword}の回答生成戦略を実装してください' },
  { name: '引用元表示', instruction: '情報源の引用に関する用語', template: '{keyword}の引用元を表示してください' },
  { name: '信頼度スコア', instruction: '回答の信頼度評価用語', template: '{keyword}の信頼度スコアを計算してください' },
  { name: 'フォールバック処理', instruction: 'フォールバック戦略の用語', template: '{keyword}のフォールバック処理を設定してください' },
  { name: 'レート制限', instruction: 'API利用制限の用語', template: '{keyword}のレート制限を設定してください' },
  { name: 'コスト最適化', instruction: 'AI利用コストの最適化用語', template: '{keyword}のコストを最適化してください' },
  { name: 'モデル選択', instruction: 'AIモデル選択の用語', template: '{keyword}に最適なモデルを選択してください' },
  { name: 'テンプレート管理', instruction: 'プロンプトテンプレート管理の用語', template: '{keyword}のテンプレートを管理してください' },
  { name: 'ワークフロー自動化', instruction: 'ワークフロー自動化の用語', template: '{keyword}のワークフローを自動化してください' },
  { name: '通知システム', instruction: '通知・アラートの用語', template: '{keyword}の通知システムを設定してください' },
  { name: 'ダッシュボード設計', instruction: 'ダッシュボードの設計用語', template: '{keyword}のダッシュボードを設計してください' },
  { name: 'レポート生成', instruction: 'レポート自動生成の用語', template: '{keyword}のレポートを生成してください' },
  { name: 'データ可視化', instruction: 'データの視覚化用語', template: '{keyword}のデータを可視化してください' },
  { name: 'ユーザー管理', instruction: 'ユーザー管理に関する用語', template: '{keyword}のユーザー管理を実装してください' },
  { name: 'ロール管理', instruction: 'ロールベースアクセス制御の用語', template: '{keyword}のロール管理を設定してください' },
  { name: '監視アラート', instruction: 'システム監視アラートの用語', template: '{keyword}の監視アラートを設定してください' },
  { name: 'バックアップ戦略', instruction: 'データバックアップの用語', template: '{keyword}のバックアップ戦略を実施してください' },
  { name: '障害復旧', instruction: '障害復旧に関する用語', template: '{keyword}の障害復旧手順を設定してください' },
  { name: 'SLA管理', instruction: 'サービスレベル管理の用語', template: '{keyword}のSLAを管理してください' },
  { name: 'ドキュメント変換', instruction: 'ドキュメント形式変換の用語', template: '{keyword}のドキュメントを変換してください' },
  { name: 'ファイル管理', instruction: 'ファイル管理システムの用語', template: '{keyword}のファイル管理を実装してください' },
  { name: 'ストレージ最適化', instruction: 'ストレージ効率化の用語', template: '{keyword}のストレージを最適化してください' },
  { name: 'データ移行', instruction: 'データ移行プロセスの用語', template: '{keyword}のデータ移行を実施してください' },
]

// ===========================================================================
// Keyword pools — Japanese keywords with English translations
// Organized by category for realistic distribution across tasks
// ===========================================================================
const keywordPools = {
  // Document types & formats
  documentTypes: [
    ['契約書', 'Contract'], ['仕様書', 'Specification'], ['マニュアル', 'Manual'],
    ['報告書', 'Report'], ['議事録', 'Meeting Minutes'], ['提案書', 'Proposal'],
    ['見積書', 'Quotation'], ['請求書', 'Invoice'], ['納品書', 'Delivery Note'],
    ['注文書', 'Purchase Order'], ['設計書', 'Design Document'], ['要件定義書', 'Requirements Document'],
    ['テスト仕様書', 'Test Specification'], ['運用手順書', 'Operation Procedure'], ['障害報告書', 'Incident Report'],
    ['品質管理文書', 'Quality Control Document'], ['安全データシート', 'Safety Data Sheet'], ['技術文書', 'Technical Document'],
    ['ユーザーガイド', 'User Guide'], ['リリースノート', 'Release Notes'], ['API仕様書', 'API Specification'],
    ['データベース設計書', 'Database Design Doc'], ['ネットワーク構成図', 'Network Diagram'], ['業務フロー図', 'Business Flow'],
    ['組織図', 'Organization Chart'], ['工程表', 'Schedule'], ['予算書', 'Budget Plan'],
    ['監査報告書', 'Audit Report'], ['コンプライアンス文書', 'Compliance Document'], ['社内規程', 'Internal Regulation'],
  ],
  // RAG/AI technical terms
  ragTerms: [
    ['チャンク', 'Chunk'], ['エンベディング', 'Embedding'], ['ベクトル', 'Vector'],
    ['トークン', 'Token'], ['プロンプト', 'Prompt'], ['コンテキスト', 'Context'],
    ['リトリーバル', 'Retrieval'], ['インデックス', 'Index'], ['メタデータ', 'Metadata'],
    ['セマンティック', 'Semantic'], ['コサイン類似度', 'Cosine Similarity'], ['ファインチューニング', 'Fine-tuning'],
    ['推論', 'Inference'], ['学習率', 'Learning Rate'], ['バッチサイズ', 'Batch Size'],
    ['エポック', 'Epoch'], ['損失関数', 'Loss Function'], ['活性化関数', 'Activation Function'],
    ['正則化', 'Regularization'], ['ドロップアウト', 'Dropout'], ['アテンション', 'Attention'],
    ['トランスフォーマー', 'Transformer'], ['エンコーダー', 'Encoder'], ['デコーダー', 'Decoder'],
    ['生成モデル', 'Generative Model'], ['判別モデル', 'Discriminative Model'], ['事前学習', 'Pre-training'],
    ['転移学習', 'Transfer Learning'], ['蒸留', 'Distillation'], ['量子化', 'Quantization'],
    ['プルーニング', 'Pruning'], ['アンサンブル', 'Ensemble'], ['ハイパーパラメータ', 'Hyperparameter'],
    ['勾配降下法', 'Gradient Descent'], ['逆伝播', 'Backpropagation'], ['畳み込み', 'Convolution'],
    ['再帰型', 'Recurrent'], ['自己教師あり学習', 'Self-supervised Learning'], ['強化学習', 'Reinforcement Learning'],
    ['模倣学習', 'Imitation Learning'],
  ],
  // Search & retrieval terms
  searchTerms: [
    ['全文検索', 'Full-text Search'], ['キーワード検索', 'Keyword Search'], ['ファジー検索', 'Fuzzy Search'],
    ['ワイルドカード検索', 'Wildcard Search'], ['フレーズ検索', 'Phrase Search'], ['ブール検索', 'Boolean Search'],
    ['近接検索', 'Proximity Search'], ['範囲検索', 'Range Search'], ['フィルター検索', 'Filtered Search'],
    ['ファセット検索', 'Faceted Search'], ['オートコンプリート', 'Autocomplete'], ['サジェスト', 'Suggest'],
    ['スペル補正', 'Spell Correction'], ['同義語展開', 'Synonym Expansion'], ['ステミング', 'Stemming'],
    ['レンマ化', 'Lemmatization'], ['ストップワード', 'Stop Words'], ['TF-IDF', 'TF-IDF'],
    ['BM25', 'BM25'], ['ページランク', 'PageRank'], ['逆インデックス', 'Inverted Index'],
    ['前方一致', 'Prefix Match'], ['後方一致', 'Suffix Match'], ['部分一致', 'Partial Match'],
    ['完全一致', 'Exact Match'], ['あいまい検索', 'Approximate Search'], ['類似検索', 'Similarity Search'],
    ['ベクトル検索', 'Vector Search'], ['ハイブリッド検索', 'Hybrid Search'], ['再検索', 'Re-search'],
  ],
  // Data processing terms
  dataTerms: [
    ['前処理', 'Preprocessing'], ['後処理', 'Postprocessing'], ['正規化', 'Normalization'],
    ['標準化', 'Standardization'], ['欠損値処理', 'Missing Value Handling'], ['外れ値検出', 'Outlier Detection'],
    ['特徴量抽出', 'Feature Extraction'], ['次元削減', 'Dimensionality Reduction'], ['データ拡張', 'Data Augmentation'],
    ['サンプリング', 'Sampling'], ['アンダーサンプリング', 'Under-sampling'], ['オーバーサンプリング', 'Over-sampling'],
    ['交差検証', 'Cross-validation'], ['ホールドアウト', 'Hold-out'], ['ブートストラップ', 'Bootstrap'],
    ['パイプライン', 'Pipeline'], ['ワークフロー', 'Workflow'], ['ジョブスケジューリング', 'Job Scheduling'],
    ['ストリーミング', 'Streaming'], ['バッチ処理', 'Batch Processing'], ['並列処理', 'Parallel Processing'],
    ['分散処理', 'Distributed Processing'], ['マップリデュース', 'MapReduce'], ['シャーディング', 'Sharding'],
    ['レプリケーション', 'Replication'], ['パーティショニング', 'Partitioning'], ['圧縮', 'Compression'],
    ['シリアライゼーション', 'Serialization'], ['デシリアライゼーション', 'Deserialization'], ['変換', 'Transformation'],
  ],
  // NLP terms
  nlpTerms: [
    ['形態素解析', 'Morphological Analysis'], ['構文解析', 'Syntactic Analysis'], ['意味解析', 'Semantic Analysis'],
    ['固有表現認識', 'Named Entity Recognition'], ['感情分析', 'Sentiment Analysis'], ['文書分類', 'Document Classification'],
    ['テキストマイニング', 'Text Mining'], ['情報抽出', 'Information Extraction'], ['関係抽出', 'Relation Extraction'],
    ['共参照解析', 'Coreference Resolution'], ['文書要約', 'Text Summarization'], ['機械翻訳', 'Machine Translation'],
    ['質問応答', 'Question Answering'], ['対話システム', 'Dialog System'], ['言語モデル', 'Language Model'],
    ['トピック分析', 'Topic Analysis'], ['クラスタリング', 'Clustering'], ['分類', 'Classification'],
    ['回帰', 'Regression'], ['系列ラベリング', 'Sequence Labeling'], ['品詞タグ付け', 'POS Tagging'],
    ['依存構造解析', 'Dependency Parsing'], ['談話解析', 'Discourse Analysis'], ['語義曖昧性解消', 'Word Sense Disambiguation'],
    ['含意関係認識', 'Textual Entailment'], ['パラフレーズ検出', 'Paraphrase Detection'], ['文類似度', 'Sentence Similarity'],
    ['キーフレーズ抽出', 'Keyphrase Extraction'], ['自動要約', 'Automatic Summarization'], ['テキスト生成', 'Text Generation'],
  ],
  // Infrastructure & system terms
  infraTerms: [
    ['ロードバランサー', 'Load Balancer'], ['リバースプロキシ', 'Reverse Proxy'], ['CDN', 'CDN'],
    ['DNS', 'DNS'], ['SSL/TLS', 'SSL/TLS'], ['ファイアウォール', 'Firewall'],
    ['VPN', 'VPN'], ['サブネット', 'Subnet'], ['ゲートウェイ', 'Gateway'],
    ['クラスター', 'Cluster'], ['ノード', 'Node'], ['ポッド', 'Pod'],
    ['コンテナ', 'Container'], ['イメージ', 'Image'], ['レジストリ', 'Registry'],
    ['オーケストレーション', 'Orchestration'], ['サービスメッシュ', 'Service Mesh'], ['サイドカー', 'Sidecar'],
    ['イングレス', 'Ingress'], ['エグレス', 'Egress'], ['スケーリング', 'Scaling'],
    ['オートスケール', 'Auto-scaling'], ['ヘルスチェック', 'Health Check'], ['フェイルオーバー', 'Failover'],
    ['冗長化', 'Redundancy'], ['可用性', 'Availability'], ['耐障害性', 'Fault Tolerance'],
    ['レイテンシー', 'Latency'], ['スループット', 'Throughput'], ['帯域幅', 'Bandwidth'],
  ],
  // Database terms
  dbTerms: [
    ['テーブル', 'Table'], ['カラム', 'Column'], ['行', 'Row'],
    ['プライマリキー', 'Primary Key'], ['外部キー', 'Foreign Key'], ['インデックス', 'Index'],
    ['ビュー', 'View'], ['ストアドプロシージャ', 'Stored Procedure'], ['トリガー', 'Trigger'],
    ['トランザクション', 'Transaction'], ['ロック', 'Lock'], ['デッドロック', 'Deadlock'],
    ['正規化', 'Normalization'], ['非正規化', 'Denormalization'], ['結合', 'Join'],
    ['サブクエリ', 'Subquery'], ['集約', 'Aggregation'], ['グループ化', 'Grouping'],
    ['ソート', 'Sort'], ['ページネーション', 'Pagination'], ['カーソル', 'Cursor'],
    ['バックアップ', 'Backup'], ['リストア', 'Restore'], ['レプリカ', 'Replica'],
    ['シャード', 'Shard'], ['パーティション', 'Partition'], ['マイグレーション', 'Migration'],
    ['スキーマ', 'Schema'], ['制約', 'Constraint'], ['参照整合性', 'Referential Integrity'],
  ],
  // Business & domain terms
  businessTerms: [
    ['売上', 'Revenue'], ['利益', 'Profit'], ['コスト', 'Cost'],
    ['予算', 'Budget'], ['決算', 'Settlement'], ['会計', 'Accounting'],
    ['在庫', 'Inventory'], ['発注', 'Ordering'], ['納品', 'Delivery'],
    ['品質', 'Quality'], ['検査', 'Inspection'], ['承認', 'Approval'],
    ['申請', 'Application'], ['稟議', 'Authorization Request'], ['決裁', 'Decision'],
    ['顧客', 'Customer'], ['取引先', 'Business Partner'], ['サプライヤー', 'Supplier'],
    ['プロジェクト', 'Project'], ['タスク', 'Task'], ['マイルストーン', 'Milestone'],
    ['工程', 'Process'], ['生産', 'Production'], ['出荷', 'Shipment'],
    ['返品', 'Return'], ['クレーム', 'Claim'], ['保証', 'Warranty'],
    ['契約', 'Contract'], ['見積', 'Estimate'], ['入札', 'Bidding'],
  ],
  // Security terms
  securityTerms: [
    ['認証', 'Authentication'], ['認可', 'Authorization'], ['暗号化', 'Encryption'],
    ['復号化', 'Decryption'], ['ハッシュ', 'Hash'], ['署名', 'Signature'],
    ['証明書', 'Certificate'], ['公開鍵', 'Public Key'], ['秘密鍵', 'Private Key'],
    ['アクセス制御', 'Access Control'], ['ロール', 'Role'], ['権限', 'Permission'],
    ['トークン', 'Token'], ['セッション', 'Session'], ['クッキー', 'Cookie'],
    ['CORS', 'CORS'], ['CSRF', 'CSRF'], ['XSS', 'XSS'],
    ['SQL インジェクション', 'SQL Injection'], ['ブルートフォース', 'Brute Force'], ['辞書攻撃', 'Dictionary Attack'],
    ['多要素認証', 'Multi-factor Auth'], ['シングルサインオン', 'Single Sign-On'], ['OAUTH', 'OAuth'],
    ['SAML', 'SAML'], ['LDAP', 'LDAP'], ['監査', 'Audit'],
    ['侵入検知', 'Intrusion Detection'], ['脆弱性', 'Vulnerability'], ['ペネトレーション', 'Penetration'],
  ],
  // Quality & evaluation terms
  qualityTerms: [
    ['精度', 'Accuracy'], ['再現率', 'Recall'], ['適合率', 'Precision'],
    ['F値', 'F-score'], ['AUC', 'AUC'], ['ROC曲線', 'ROC Curve'],
    ['混同行列', 'Confusion Matrix'], ['偽陽性', 'False Positive'], ['偽陰性', 'False Negative'],
    ['真陽性', 'True Positive'], ['真陰性', 'True Negative'], ['感度', 'Sensitivity'],
    ['特異度', 'Specificity'], ['BLEU', 'BLEU'], ['ROUGE', 'ROUGE'],
    ['NDCG', 'NDCG'], ['MRR', 'MRR'], ['MAP', 'MAP'],
    ['ヒット率', 'Hit Rate'], ['カバレッジ', 'Coverage'], ['多様性', 'Diversity'],
    ['鮮度', 'Freshness'], ['関連性', 'Relevance'], ['有用性', 'Usefulness'],
    ['一貫性', 'Consistency'], ['完全性', 'Completeness'], ['正確性', 'Correctness'],
    ['応答時間', 'Response Time'], ['可用性', 'Availability'], ['信頼性', 'Reliability'],
  ],
}

// ===========================================================================
// Build rows — distribute keywords across tasks
// ===========================================================================
const allKeywordCategories = Object.values(keywordPools)

// ===========================================================================
// Generate Task import rows (task_name, task_instruction, context_template only)
// ===========================================================================
const taskRows = tasks.map(task => ({
  task_name: task.name,
  task_instruction: task.instruction,
  context_template: task.template,
}))

console.log(`Generated ${taskRows.length} task rows`)

const ws = XLSX.utils.json_to_sheet(taskRows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Task Import')

const taskPath = path.join(__dirname, '..', 'glossary_task_import_sample.xlsx')
XLSX.writeFile(wb, taskPath)
console.log(`Task import file: ${taskPath} (${taskRows.length} rows)`)

// ===========================================================================
// Generate Keyword import rows — 3000 UNIQUE keywords
// ===========================================================================
const TARGET_COUNT = 3000
const uniqueKeywords = new Map() // key: lowercase name -> { name, en_keyword, description }

// Step 1: Collect all keywords from existing pools (deduplicated)
for (const category of allKeywordCategories) {
  for (const [jpName, enName] of category) {
    const key = jpName.trim().toLowerCase()
    if (!uniqueKeywords.has(key)) {
      uniqueKeywords.set(key, {
        name: jpName,
        en_keyword: enName,
        description: `${enName} — RAG文書Q&Aに関連する用語`,
      })
    }
  }
}

console.log(`Base unique keywords from pools: ${uniqueKeywords.size}`)

// Step 2: Additional keyword categories to reach 3000 unique keywords
const extraKeywords = [
  // Cloud & DevOps (60)
  ['Amazon S3', 'Amazon S3'], ['Amazon EC2', 'Amazon EC2'], ['Amazon RDS', 'Amazon RDS'],
  ['Amazon Lambda', 'AWS Lambda'], ['Amazon SQS', 'Amazon SQS'], ['Amazon SNS', 'Amazon SNS'],
  ['Amazon DynamoDB', 'Amazon DynamoDB'], ['Amazon CloudFront', 'Amazon CloudFront'],
  ['Amazon ECS', 'Amazon ECS'], ['Amazon EKS', 'Amazon EKS'],
  ['Azure Blob', 'Azure Blob Storage'], ['Azure Functions', 'Azure Functions'],
  ['Azure Cosmos DB', 'Azure Cosmos DB'], ['Azure DevOps', 'Azure DevOps'],
  ['Azure Kubernetes', 'Azure Kubernetes'], ['Google Cloud Storage', 'Google Cloud Storage'],
  ['BigQuery', 'BigQuery'], ['Cloud Run', 'Cloud Run'], ['Cloud Functions', 'Cloud Functions'],
  ['Pub/Sub', 'Google Pub/Sub'], ['Terraform', 'Terraform'], ['Ansible', 'Ansible'],
  ['Pulumi', 'Pulumi'], ['CloudFormation', 'CloudFormation'], ['Helm チャート', 'Helm Chart'],
  ['Kubernetes マニフェスト', 'Kubernetes Manifest'], ['Docker Compose', 'Docker Compose'],
  ['Dockerfile', 'Dockerfile'], ['CI パイプライン', 'CI Pipeline'], ['CD パイプライン', 'CD Pipeline'],
  ['GitOps', 'GitOps'], ['ArgoCD', 'ArgoCD'], ['FluxCD', 'FluxCD'],
  ['Jenkins', 'Jenkins'], ['GitHub Actions', 'GitHub Actions'], ['GitLab CI', 'GitLab CI'],
  ['CircleCI', 'CircleCI'], ['Travis CI', 'Travis CI'], ['ブルーグリーンデプロイ', 'Blue-Green Deployment'],
  ['カナリアデプロイ', 'Canary Deployment'], ['ローリングアップデート', 'Rolling Update'],
  ['イミュータブルインフラ', 'Immutable Infrastructure'], ['インフラストラクチャ・アズ・コード', 'Infrastructure as Code'],
  ['サーバーレス', 'Serverless'], ['FaaS', 'Function as a Service'],
  ['PaaS', 'Platform as a Service'], ['IaaS', 'Infrastructure as a Service'],
  ['SaaS', 'Software as a Service'], ['マルチクラウド', 'Multi-Cloud'],
  ['ハイブリッドクラウド', 'Hybrid Cloud'], ['プライベートクラウド', 'Private Cloud'],
  ['パブリッククラウド', 'Public Cloud'], ['クラウドネイティブ', 'Cloud Native'],
  ['コンテナレジストリ', 'Container Registry'], ['サービスディスカバリ', 'Service Discovery'],
  ['設定管理', 'Configuration Management'], ['シークレット管理', 'Secret Management'],
  ['環境変数', 'Environment Variable'], ['デプロイメント戦略', 'Deployment Strategy'],
  ['リリース管理', 'Release Management'], ['フィーチャーフラグ', 'Feature Flag'],

  // Programming languages & frameworks (60)
  ['Python', 'Python'], ['JavaScript', 'JavaScript'], ['TypeScript', 'TypeScript'],
  ['Java', 'Java'], ['Go言語', 'Go Language'], ['Rust', 'Rust'],
  ['C++', 'C++'], ['C#', 'C#'], ['Ruby', 'Ruby'],
  ['PHP', 'PHP'], ['Swift', 'Swift'], ['Kotlin', 'Kotlin'],
  ['Scala', 'Scala'], ['R言語', 'R Language'], ['Julia', 'Julia'],
  ['React', 'React'], ['Vue.js', 'Vue.js'], ['Angular', 'Angular'],
  ['Next.js', 'Next.js'], ['Nuxt.js', 'Nuxt.js'], ['Svelte', 'Svelte'],
  ['Express.js', 'Express.js'], ['FastAPI', 'FastAPI'], ['Django', 'Django'],
  ['Flask', 'Flask'], ['Spring Boot', 'Spring Boot'], ['Rails', 'Rails'],
  ['Laravel', 'Laravel'], ['ASP.NET', 'ASP.NET'], ['NestJS', 'NestJS'],
  ['GraphQL', 'GraphQL'], ['REST API', 'REST API'], ['gRPC', 'gRPC'],
  ['WebSocket', 'WebSocket'], ['Server-Sent Events', 'Server-Sent Events'],
  ['Protocol Buffers', 'Protocol Buffers'], ['JSON Schema', 'JSON Schema'],
  ['OpenAPI', 'OpenAPI'], ['Swagger', 'Swagger'], ['Postman', 'Postman'],
  ['npm', 'npm'], ['yarn', 'yarn'], ['pnpm', 'pnpm'],
  ['webpack', 'webpack'], ['Vite', 'Vite'], ['esbuild', 'esbuild'],
  ['Babel', 'Babel'], ['ESLint', 'ESLint'], ['Prettier', 'Prettier'],
  ['Jest', 'Jest'], ['Vitest', 'Vitest'], ['Playwright', 'Playwright'],
  ['Cypress', 'Cypress'], ['Selenium', 'Selenium'], ['Puppeteer', 'Puppeteer'],
  ['Storybook', 'Storybook'], ['Chromatic', 'Chromatic'], ['Tailwind CSS', 'Tailwind CSS'],
  ['Material UI', 'Material UI'], ['Ant Design', 'Ant Design'],

  // Database & storage (60)
  ['PostgreSQL', 'PostgreSQL'], ['MySQL', 'MySQL'], ['MariaDB', 'MariaDB'],
  ['SQL Server', 'SQL Server'], ['Oracle DB', 'Oracle Database'], ['SQLite', 'SQLite'],
  ['MongoDB', 'MongoDB'], ['Redis', 'Redis'], ['Memcached', 'Memcached'],
  ['Elasticsearch', 'Elasticsearch'], ['OpenSearch', 'OpenSearch'], ['Solr', 'Apache Solr'],
  ['Cassandra', 'Apache Cassandra'], ['ScyllaDB', 'ScyllaDB'], ['CockroachDB', 'CockroachDB'],
  ['TiDB', 'TiDB'], ['Vitess', 'Vitess'], ['Neo4j', 'Neo4j'],
  ['ArangoDB', 'ArangoDB'], ['DGraph', 'DGraph'], ['InfluxDB', 'InfluxDB'],
  ['TimescaleDB', 'TimescaleDB'], ['ClickHouse', 'ClickHouse'], ['Druid', 'Apache Druid'],
  ['Pinecone', 'Pinecone'], ['Weaviate', 'Weaviate'], ['Milvus', 'Milvus'],
  ['Qdrant', 'Qdrant'], ['ChromaDB', 'ChromaDB'], ['pgvector', 'pgvector'],
  ['FAISS', 'FAISS'], ['Annoy', 'Annoy'], ['HNSWlib', 'HNSWlib'],
  ['MinIO', 'MinIO'], ['Ceph', 'Ceph'], ['GlusterFS', 'GlusterFS'],
  ['HDFS', 'HDFS'], ['Apache Parquet', 'Apache Parquet'], ['Apache Avro', 'Apache Avro'],
  ['Apache ORC', 'Apache ORC'], ['Delta Lake', 'Delta Lake'], ['Apache Iceberg', 'Apache Iceberg'],
  ['Apache Hudi', 'Apache Hudi'], ['Apache Kafka', 'Apache Kafka'], ['RabbitMQ', 'RabbitMQ'],
  ['Apache Pulsar', 'Apache Pulsar'], ['NATS', 'NATS'], ['ZeroMQ', 'ZeroMQ'],
  ['Apache Flink', 'Apache Flink'], ['Apache Spark', 'Apache Spark'], ['Apache Beam', 'Apache Beam'],
  ['Presto', 'Presto'], ['Trino', 'Trino'], ['dbt', 'dbt'],
  ['Airflow', 'Apache Airflow'], ['Dagster', 'Dagster'], ['Prefect', 'Prefect'],
  ['Apache NiFi', 'Apache NiFi'], ['Debezium', 'Debezium'], ['Fivetran', 'Fivetran'],

  // AI/ML models & tools (60)
  ['GPT-4', 'GPT-4'], ['GPT-4o', 'GPT-4o'], ['Claude', 'Claude'],
  ['Gemini', 'Gemini'], ['Llama', 'Llama'], ['Mistral', 'Mistral'],
  ['Phi', 'Phi'], ['Qwen', 'Qwen'], ['Command R', 'Command R'],
  ['BERT', 'BERT'], ['RoBERTa', 'RoBERTa'], ['DeBERTa', 'DeBERTa'],
  ['T5', 'T5'], ['BART', 'BART'], ['XLNet', 'XLNet'],
  ['ELECTRA', 'ELECTRA'], ['ALBERT', 'ALBERT'], ['DistilBERT', 'DistilBERT'],
  ['Sentence-BERT', 'Sentence-BERT'], ['ColBERT', 'ColBERT'], ['E5', 'E5'],
  ['BGE', 'BGE'], ['GTE', 'GTE'], ['Jina Embeddings', 'Jina Embeddings'],
  ['OpenAI Embeddings', 'OpenAI Embeddings'], ['Cohere Embeddings', 'Cohere Embeddings'],
  ['HuggingFace', 'HuggingFace'], ['LangChain', 'LangChain'], ['LlamaIndex', 'LlamaIndex'],
  ['Haystack', 'Haystack'], ['Semantic Kernel', 'Semantic Kernel'], ['AutoGPT', 'AutoGPT'],
  ['CrewAI', 'CrewAI'], ['Autogen', 'Autogen'], ['LoRA', 'LoRA'],
  ['QLoRA', 'QLoRA'], ['PEFT', 'PEFT'], ['DeepSpeed', 'DeepSpeed'],
  ['vLLM', 'vLLM'], ['TensorRT-LLM', 'TensorRT-LLM'], ['ONNX', 'ONNX'],
  ['TensorFlow', 'TensorFlow'], ['PyTorch', 'PyTorch'], ['JAX', 'JAX'],
  ['MLflow', 'MLflow'], ['Weights & Biases', 'Weights & Biases'], ['DVC', 'DVC'],
  ['Label Studio', 'Label Studio'], ['Prodigy', 'Prodigy'], ['Gradio', 'Gradio'],
  ['Streamlit', 'Streamlit'], ['RAGFlow', 'RAGFlow'], ['Dify', 'Dify'],
  ['Langfuse', 'Langfuse'], ['Helicone', 'Helicone'], ['LangSmith', 'LangSmith'],
  ['OpenTelemetry', 'OpenTelemetry'], ['Prometheus', 'Prometheus'], ['Grafana', 'Grafana'],
  ['Datadog', 'Datadog'], ['New Relic', 'New Relic'],

  // Document processing & OCR (50)
  ['Tesseract', 'Tesseract OCR'], ['PaddleOCR', 'PaddleOCR'], ['EasyOCR', 'EasyOCR'],
  ['Google Vision OCR', 'Google Vision OCR'], ['Azure OCR', 'Azure Form Recognizer'],
  ['Amazon Textract', 'Amazon Textract'], ['ABBYY', 'ABBYY FineReader'],
  ['PDFBox', 'Apache PDFBox'], ['PyPDF2', 'PyPDF2'], ['pdfplumber', 'pdfplumber'],
  ['Camelot', 'Camelot'], ['Tabula', 'Tabula'], ['pdf2image', 'pdf2image'],
  ['Docling', 'Docling'], ['Unstructured', 'Unstructured.io'], ['Marker', 'Marker'],
  ['Nougat', 'Nougat'], ['layoutparser', 'layoutparser'], ['YOLO文書検出', 'YOLO Document Detection'],
  ['テーブル検出', 'Table Detection'], ['レイアウト解析', 'Layout Analysis'],
  ['文字認識', 'Character Recognition'], ['手書き認識', 'Handwriting Recognition'],
  ['バーコード認識', 'Barcode Recognition'], ['QRコード認識', 'QR Code Recognition'],
  ['画像前処理', 'Image Preprocessing'], ['二値化', 'Binarization'], ['ノイズ除去', 'Noise Removal'],
  ['傾き補正', 'Deskewing'], ['回転補正', 'Rotation Correction'],
  ['ページセグメンテーション', 'Page Segmentation'], ['領域検出', 'Region Detection'],
  ['行検出', 'Line Detection'], ['単語検出', 'Word Detection'],
  ['フォント認識', 'Font Recognition'], ['言語検出', 'Language Detection'],
  ['文書構造認識', 'Document Structure Recognition'], ['見出し検出', 'Heading Detection'],
  ['段落検出', 'Paragraph Detection'], ['リスト検出', 'List Detection'],
  ['図表検出', 'Figure Detection'], ['キャプション検出', 'Caption Detection'],
  ['脚注検出', 'Footnote Detection'], ['ヘッダー検出', 'Header Detection'],
  ['フッター検出', 'Footer Detection'], ['透かし検出', 'Watermark Detection'],
  ['署名検出', 'Signature Detection'], ['スタンプ検出', 'Stamp Detection'],
  ['差分検出', 'Diff Detection'], ['版管理', 'Version Control'],

  // Networking & protocols (50)
  ['TCP/IP', 'TCP/IP'], ['UDP', 'UDP'], ['HTTP/2', 'HTTP/2'],
  ['HTTP/3', 'HTTP/3'], ['QUIC', 'QUIC'], ['MQTT', 'MQTT'],
  ['AMQP', 'AMQP'], ['CoAP', 'CoAP'], ['FTP', 'FTP'],
  ['SFTP', 'SFTP'], ['SSH', 'SSH'], ['SMTP', 'SMTP'],
  ['IMAP', 'IMAP'], ['POP3', 'POP3'], ['SNMP', 'SNMP'],
  ['NTP', 'NTP'], ['DHCP', 'DHCP'], ['ARP', 'ARP'],
  ['ICMP', 'ICMP'], ['BGP', 'BGP'], ['OSPF', 'OSPF'],
  ['VLAN', 'VLAN'], ['VXLAN', 'VXLAN'], ['SD-WAN', 'SD-WAN'],
  ['MPLS', 'MPLS'], ['IPsec', 'IPsec'], ['WireGuard', 'WireGuard'],
  ['OpenVPN', 'OpenVPN'], ['プロキシ', 'Proxy'], ['SOCKSプロキシ', 'SOCKS Proxy'],
  ['NAT', 'NAT'], ['ポートフォワーディング', 'Port Forwarding'], ['トンネリング', 'Tunneling'],
  ['パケットフィルタリング', 'Packet Filtering'], ['ディープパケットインスペクション', 'Deep Packet Inspection'],
  ['トラフィックシェーピング', 'Traffic Shaping'], ['QoS', 'Quality of Service'],
  ['ネットワークセグメンテーション', 'Network Segmentation'], ['マイクロセグメンテーション', 'Microsegmentation'],
  ['ゼロトラスト', 'Zero Trust'], ['SASE', 'SASE'], ['SSE', 'Security Service Edge'],
  ['WAF', 'Web Application Firewall'], ['DDoS防御', 'DDoS Protection'],
  ['IDS/IPS', 'IDS/IPS'], ['SIEM', 'SIEM'], ['SOAR', 'SOAR'],
  ['EDR', 'EDR'], ['XDR', 'XDR'], ['MDR', 'MDR'],

  // UI/UX & design (50)
  ['ワイヤーフレーム', 'Wireframe'], ['モックアップ', 'Mockup'], ['プロトタイプ', 'Prototype'],
  ['デザインシステム', 'Design System'], ['コンポーネントライブラリ', 'Component Library'],
  ['デザイントークン', 'Design Token'], ['カラーパレット', 'Color Palette'],
  ['タイポグラフィ', 'Typography'], ['アイコンセット', 'Icon Set'],
  ['レスポンシブデザイン', 'Responsive Design'], ['モバイルファースト', 'Mobile First'],
  ['アダプティブデザイン', 'Adaptive Design'], ['フルイドグリッド', 'Fluid Grid'],
  ['ブレイクポイント', 'Breakpoint'], ['メディアクエリ', 'Media Query'],
  ['フレックスボックス', 'Flexbox'], ['CSSグリッド', 'CSS Grid'],
  ['アニメーション', 'Animation'], ['トランジション', 'Transition'],
  ['マイクロインタラクション', 'Micro-interaction'], ['スクロールアニメーション', 'Scroll Animation'],
  ['パララックス', 'Parallax'], ['スケルトンスクリーン', 'Skeleton Screen'],
  ['ローディングスピナー', 'Loading Spinner'], ['トースト通知', 'Toast Notification'],
  ['モーダルダイアログ', 'Modal Dialog'], ['ドロップダウンメニュー', 'Dropdown Menu'],
  ['ツールチップ', 'Tooltip'], ['タブナビゲーション', 'Tab Navigation'],
  ['パンくずリスト', 'Breadcrumb'], ['サイドバー', 'Sidebar'],
  ['ナビゲーションバー', 'Navigation Bar'], ['フッターデザイン', 'Footer Design'],
  ['カード型レイアウト', 'Card Layout'], ['グリッドレイアウト', 'Grid Layout'],
  ['リストビュー', 'List View'], ['テーブルビュー', 'Table View'],
  ['ツリービュー', 'Tree View'], ['カレンダービュー', 'Calendar View'],
  ['ガントチャート', 'Gantt Chart'], ['カンバンボード', 'Kanban Board'],
  ['ダークモード', 'Dark Mode'], ['ライトモード', 'Light Mode'],
  ['テーマ切替', 'Theme Switching'], ['アクセシビリティ', 'Accessibility'],
  ['WCAG準拠', 'WCAG Compliance'], ['スクリーンリーダー', 'Screen Reader'],
  ['キーボードナビゲーション', 'Keyboard Navigation'], ['フォーカスマネジメント', 'Focus Management'],
  ['コントラスト比', 'Contrast Ratio'], ['代替テキスト', 'Alt Text'],

  // Testing & QA (50)
  ['ユニットテスト', 'Unit Test'], ['結合テスト', 'Integration Test'], ['E2Eテスト', 'End-to-End Test'],
  ['受入テスト', 'Acceptance Test'], ['スモークテスト', 'Smoke Test'], ['サニティテスト', 'Sanity Test'],
  ['パフォーマンステスト', 'Performance Test'], ['ストレステスト', 'Stress Test'],
  ['スパイクテスト', 'Spike Test'], ['ソークテスト', 'Soak Test'],
  ['セキュリティテスト', 'Security Test'], ['ファジングテスト', 'Fuzz Test'],
  ['ミューテーションテスト', 'Mutation Test'], ['スナップショットテスト', 'Snapshot Test'],
  ['ビジュアルリグレッション', 'Visual Regression'], ['コントラクトテスト', 'Contract Test'],
  ['カオスエンジニアリング', 'Chaos Engineering'], ['フォールトインジェクション', 'Fault Injection'],
  ['テストカバレッジ', 'Test Coverage'], ['コードカバレッジ', 'Code Coverage'],
  ['ブランチカバレッジ', 'Branch Coverage'], ['パスカバレッジ', 'Path Coverage'],
  ['MCDC', 'MC/DC Coverage'], ['テストダブル', 'Test Double'],
  ['モック', 'Mock'], ['スタブ', 'Stub'], ['スパイ', 'Spy'],
  ['フェイク', 'Fake'], ['テストフィクスチャ', 'Test Fixture'],
  ['テストファクトリ', 'Test Factory'], ['テストビルダー', 'Test Builder'],
  ['ページオブジェクトモデル', 'Page Object Model'], ['テストデータ管理', 'Test Data Management'],
  ['テスト環境', 'Test Environment'], ['テスト自動化', 'Test Automation'],
  ['テストオーケストレーション', 'Test Orchestration'], ['テストレポート', 'Test Report'],
  ['テストパイプライン', 'Test Pipeline'], ['QAプロセス', 'QA Process'],
  ['バグトラッキング', 'Bug Tracking'], ['欠陥管理', 'Defect Management'],
  ['リグレッション管理', 'Regression Management'], ['テスト戦略', 'Test Strategy'],
  ['リスクベーステスト', 'Risk-based Testing'], ['探索的テスト', 'Exploratory Testing'],
  ['ペアテスト', 'Pair Testing'], ['テストレビュー', 'Test Review'],
  ['テスト見積', 'Test Estimation'], ['テスト計画', 'Test Plan'],
  ['テスト設計', 'Test Design'], ['境界値分析', 'Boundary Value Analysis'],

  // Project management & agile (50)
  ['アジャイル', 'Agile'], ['スクラム', 'Scrum'], ['カンバン', 'Kanban'],
  ['スプリント', 'Sprint'], ['バックログ', 'Backlog'], ['ユーザーストーリー', 'User Story'],
  ['エピック', 'Epic'], ['ストーリーポイント', 'Story Points'], ['ベロシティ', 'Velocity'],
  ['バーンダウンチャート', 'Burndown Chart'], ['バーンアップチャート', 'Burnup Chart'],
  ['デイリースクラム', 'Daily Scrum'], ['スプリントレビュー', 'Sprint Review'],
  ['レトロスペクティブ', 'Retrospective'], ['プランニングポーカー', 'Planning Poker'],
  ['プロダクトオーナー', 'Product Owner'], ['スクラムマスター', 'Scrum Master'],
  ['ステークホルダー', 'Stakeholder'], ['MVP', 'Minimum Viable Product'],
  ['POC', 'Proof of Concept'], ['OKR', 'OKR'], ['KPI', 'KPI'],
  ['ロードマップ', 'Roadmap'], ['リリース計画', 'Release Plan'],
  ['反復開発', 'Iterative Development'], ['継続的改善', 'Continuous Improvement'],
  ['ペアプログラミング', 'Pair Programming'], ['モブプログラミング', 'Mob Programming'],
  ['コードレビュー', 'Code Review'], ['プルリクエスト', 'Pull Request'],
  ['ブランチ戦略', 'Branching Strategy'], ['トランクベース開発', 'Trunk-based Development'],
  ['GitFlow', 'Git Flow'], ['マージ戦略', 'Merge Strategy'],
  ['コンフリクト解決', 'Conflict Resolution'], ['技術的負債', 'Technical Debt'],
  ['リファクタリング', 'Refactoring'], ['設計パターン', 'Design Pattern'],
  ['SOLID原則', 'SOLID Principles'], ['DRY原則', 'DRY Principle'],
  ['KISS原則', 'KISS Principle'], ['YAGNI原則', 'YAGNI Principle'],
  ['クリーンアーキテクチャ', 'Clean Architecture'], ['ドメイン駆動設計', 'Domain-Driven Design'],
  ['イベントストーミング', 'Event Storming'], ['ユビキタス言語', 'Ubiquitous Language'],
  ['境界づけられたコンテキスト', 'Bounded Context'], ['集約', 'Aggregate'],
  ['ドメインイベント', 'Domain Event'], ['値オブジェクト', 'Value Object'],

  // Data science & analytics (50)
  ['線形回帰', 'Linear Regression'], ['ロジスティック回帰', 'Logistic Regression'],
  ['決定木', 'Decision Tree'], ['ランダムフォレスト', 'Random Forest'],
  ['勾配ブースティング', 'Gradient Boosting'], ['XGBoost', 'XGBoost'],
  ['LightGBM', 'LightGBM'], ['CatBoost', 'CatBoost'],
  ['SVM', 'Support Vector Machine'], ['KNN', 'K-Nearest Neighbors'],
  ['ナイーブベイズ', 'Naive Bayes'], ['K-means', 'K-means'],
  ['DBSCAN', 'DBSCAN'], ['階層的クラスタリング', 'Hierarchical Clustering'],
  ['PCA', 'Principal Component Analysis'], ['t-SNE', 't-SNE'],
  ['UMAP', 'UMAP'], ['オートエンコーダ', 'Autoencoder'],
  ['GAN', 'Generative Adversarial Network'], ['VAE', 'Variational Autoencoder'],
  ['拡散モデル', 'Diffusion Model'], ['Vision Transformer', 'Vision Transformer'],
  ['CLIP', 'CLIP'], ['DALL-E', 'DALL-E'], ['Stable Diffusion', 'Stable Diffusion'],
  ['Whisper', 'Whisper'], ['音声認識', 'Speech Recognition'], ['音声合成', 'Speech Synthesis'],
  ['画像分類', 'Image Classification'], ['物体検出', 'Object Detection'],
  ['セマンティックセグメンテーション', 'Semantic Segmentation'], ['インスタンスセグメンテーション', 'Instance Segmentation'],
  ['ポーズ推定', 'Pose Estimation'], ['顔認識', 'Face Recognition'],
  ['異常検知', 'Anomaly Detection'], ['時系列予測', 'Time Series Forecasting'],
  ['推薦システム', 'Recommendation System'], ['協調フィルタリング', 'Collaborative Filtering'],
  ['コンテンツベースフィルタリング', 'Content-based Filtering'], ['A/B テスト分析', 'A/B Test Analysis'],
  ['仮説検定', 'Hypothesis Testing'], ['信頼区間', 'Confidence Interval'],
  ['p値', 'p-value'], ['効果量', 'Effect Size'],
  ['ベイズ推定', 'Bayesian Inference'], ['マルコフ連鎖', 'Markov Chain'],
  ['モンテカルロ法', 'Monte Carlo Method'], ['ニューラルネットワーク', 'Neural Network'],
  ['深層学習', 'Deep Learning'], ['機械学習', 'Machine Learning'],

  // Business & industry terms (60)
  ['サプライチェーン', 'Supply Chain'], ['需要予測', 'Demand Forecasting'],
  ['在庫最適化', 'Inventory Optimization'], ['物流管理', 'Logistics Management'],
  ['調達管理', 'Procurement Management'], ['品質保証体系', 'Quality Assurance System'],
  ['ISO 9001', 'ISO 9001'], ['ISO 27001', 'ISO 27001'], ['SOC2', 'SOC2'],
  ['GDPR', 'GDPR'], ['HIPAA', 'HIPAA'], ['PCI DSS', 'PCI DSS'],
  ['内部統制', 'Internal Control'], ['リスク管理', 'Risk Management'],
  ['事業継続計画', 'Business Continuity Plan'], ['災害復旧計画', 'Disaster Recovery Plan'],
  ['変更管理', 'Change Management'], ['インシデント管理', 'Incident Management'],
  ['問題管理', 'Problem Management'], ['構成管理', 'Configuration Management'],
  ['サービスデスク', 'Service Desk'], ['ITIL', 'ITIL'],
  ['IT資産管理', 'IT Asset Management'], ['ライセンス管理', 'License Management'],
  ['ベンダー管理', 'Vendor Management'], ['SaaS管理', 'SaaS Management'],
  ['クラウドコスト最適化', 'Cloud Cost Optimization'], ['FinOps', 'FinOps'],
  ['デジタルトランスフォーメーション', 'Digital Transformation'], ['DX戦略', 'DX Strategy'],
  ['業務自動化', 'Business Automation'], ['RPA', 'Robotic Process Automation'],
  ['BPM', 'Business Process Management'], ['ローコード', 'Low-Code'],
  ['ノーコード', 'No-Code'], ['市民開発者', 'Citizen Developer'],
  ['データドリブン', 'Data-Driven'], ['意思決定支援', 'Decision Support'],
  ['ビジネスインテリジェンス', 'Business Intelligence'], ['ETL処理', 'ETL Processing'],
  ['データウェアハウス', 'Data Warehouse'], ['データマート', 'Data Mart'],
  ['OLAP', 'OLAP'], ['OLTP', 'OLTP'],
  ['マスターデータ管理', 'Master Data Management'], ['データカタログ', 'Data Catalog'],
  ['データ品質管理', 'Data Quality Management'], ['データスチュワードシップ', 'Data Stewardship'],
  ['メタデータ管理', 'Metadata Management'], ['データリテラシー', 'Data Literacy'],
  ['CRM', 'Customer Relationship Management'], ['ERP', 'Enterprise Resource Planning'],
  ['HRM', 'Human Resource Management'], ['SCM', 'Supply Chain Management'],
  ['WMS', 'Warehouse Management System'], ['TMS', 'Transport Management System'],
  ['MES', 'Manufacturing Execution System'], ['PLM', 'Product Lifecycle Management'],
  ['CAD', 'Computer-Aided Design'], ['CAM', 'Computer-Aided Manufacturing'],

  // Compliance & governance (40)
  ['個人情報保護', 'Personal Data Protection'], ['データ主体の権利', 'Data Subject Rights'],
  ['データ処理契約', 'Data Processing Agreement'], ['プライバシーバイデザイン', 'Privacy by Design'],
  ['データ保護影響評価', 'Data Protection Impact Assessment'], ['データ侵害通知', 'Data Breach Notification'],
  ['同意管理', 'Consent Management'], ['クッキーポリシー', 'Cookie Policy'],
  ['プライバシーポリシー', 'Privacy Policy'], ['利用規約', 'Terms of Service'],
  ['情報セキュリティ方針', 'Information Security Policy'], ['アクセスポリシー', 'Access Policy'],
  ['パスワードポリシー', 'Password Policy'], ['データ保持ポリシー', 'Data Retention Policy'],
  ['データ分類', 'Data Classification'], ['データマスキング', 'Data Masking'],
  ['匿名化', 'Anonymization'], ['仮名化', 'Pseudonymization'],
  ['暗号化ポリシー', 'Encryption Policy'], ['鍵管理', 'Key Management'],
  ['証明書管理', 'Certificate Management'], ['PKI', 'Public Key Infrastructure'],
  ['デジタル署名', 'Digital Signature'], ['タイムスタンプ', 'Timestamp'],
  ['電子署名', 'Electronic Signature'], ['ドキュメント管理システム', 'Document Management System'],
  ['レコード管理', 'Records Management'], ['アーカイブ管理', 'Archive Management'],
  ['保存期限', 'Retention Period'], ['廃棄手順', 'Disposal Procedure'],
  ['eディスカバリ', 'eDiscovery'], ['法的保全', 'Legal Hold'],
  ['フォレンジック', 'Digital Forensics'], ['証拠保全', 'Evidence Preservation'],
  ['チェーンオブカストディ', 'Chain of Custody'], ['脅威インテリジェンス', 'Threat Intelligence'],
  ['脆弱性管理', 'Vulnerability Management'], ['パッチ管理', 'Patch Management'],
  ['ペネトレーションテスト', 'Penetration Test'], ['レッドチーム', 'Red Team'],

  // RAG-specific advanced terms (50)
  ['チャンク戦略', 'Chunking Strategy'], ['再帰的チャンキング', 'Recursive Chunking'],
  ['セマンティックチャンキング', 'Semantic Chunking'], ['固定長チャンキング', 'Fixed-size Chunking'],
  ['オーバーラップチャンキング', 'Overlapping Chunks'], ['親子チャンキング', 'Parent-Child Chunking'],
  ['コンテキストウィンドウ', 'Context Window'], ['コンテキスト圧縮', 'Context Compression'],
  ['ロストインザミドル', 'Lost in the Middle'], ['プロンプトインジェクション', 'Prompt Injection'],
  ['プロンプトリーキング', 'Prompt Leaking'], ['ジェイルブレイク', 'Jailbreak'],
  ['ガードレール', 'Guardrails'], ['コンテンツフィルタリング', 'Content Filtering'],
  ['毒性検出', 'Toxicity Detection'], ['バイアス検出', 'Bias Detection'],
  ['公平性', 'Fairness'], ['説明可能性', 'Explainability'],
  ['解釈可能性', 'Interpretability'], ['透明性', 'Transparency'],
  ['再現性', 'Reproducibility'], ['監査可能性', 'Auditability'],
  ['モデル評価', 'Model Evaluation'], ['人間による評価', 'Human Evaluation'],
  ['自動評価', 'Automatic Evaluation'], ['LLM-as-Judge', 'LLM-as-Judge'],
  ['ベンチマーク', 'Benchmark'], ['リーダーボード', 'Leaderboard'],
  ['ハルシネーション検出', 'Hallucination Detection'], ['ファクトチェック', 'Fact Checking'],
  ['根拠付け', 'Grounding'], ['引用生成', 'Citation Generation'],
  ['ソース帰属', 'Source Attribution'], ['知識蒸留', 'Knowledge Distillation'],
  ['モデルマージ', 'Model Merging'], ['モデルアラインメント', 'Model Alignment'],
  ['RLHF', 'RLHF'], ['DPO', 'DPO'], ['PPO', 'PPO'],
  ['Constitutional AI', 'Constitutional AI'], ['Chain-of-Thought', 'Chain-of-Thought'],
  ['Few-shotプロンプティング', 'Few-shot Prompting'], ['Zero-shotプロンプティング', 'Zero-shot Prompting'],
  ['Self-consistency', 'Self-consistency'], ['Tree-of-Thought', 'Tree-of-Thought'],
  ['ReAct', 'ReAct'], ['エージェントフレームワーク', 'Agent Framework'],
  ['ツール使用', 'Tool Use'], ['関数呼び出し', 'Function Calling'],
  ['マルチエージェント', 'Multi-Agent'], ['オーケストレーター', 'Orchestrator'],

  // Mathematics & statistics (40)
  ['行列演算', 'Matrix Operations'], ['固有値分解', 'Eigendecomposition'],
  ['特異値分解', 'Singular Value Decomposition'], ['行列式', 'Determinant'],
  ['逆行列', 'Inverse Matrix'], ['転置行列', 'Transpose Matrix'],
  ['内積', 'Dot Product'], ['外積', 'Cross Product'],
  ['ノルム', 'Norm'], ['コサイン距離', 'Cosine Distance'],
  ['ユークリッド距離', 'Euclidean Distance'], ['マンハッタン距離', 'Manhattan Distance'],
  ['ハミング距離', 'Hamming Distance'], ['ジャッカード係数', 'Jaccard Index'],
  ['相関係数', 'Correlation Coefficient'], ['共分散', 'Covariance'],
  ['分散', 'Variance'], ['標準偏差', 'Standard Deviation'],
  ['平均値', 'Mean'], ['中央値', 'Median'],
  ['最頻値', 'Mode'], ['パーセンタイル', 'Percentile'],
  ['四分位数', 'Quartile'], ['ヒストグラム', 'Histogram'],
  ['箱ひげ図', 'Box Plot'], ['散布図', 'Scatter Plot'],
  ['ヒートマップ', 'Heatmap'], ['相関行列', 'Correlation Matrix'],
  ['正規分布', 'Normal Distribution'], ['ポアソン分布', 'Poisson Distribution'],
  ['二項分布', 'Binomial Distribution'], ['一様分布', 'Uniform Distribution'],
  ['指数分布', 'Exponential Distribution'], ['カイ二乗分布', 'Chi-squared Distribution'],
  ['t分布', 't-Distribution'], ['F分布', 'F-Distribution'],
  ['最尤推定', 'Maximum Likelihood Estimation'], ['最小二乗法', 'Least Squares Method'],
  ['勾配法', 'Gradient Method'], ['凸最適化', 'Convex Optimization'],

  // Communication & collaboration (50)
  ['Slack', 'Slack'], ['Microsoft Teams', 'Microsoft Teams'],
  ['Zoom', 'Zoom'], ['Google Meet', 'Google Meet'],
  ['Discord', 'Discord'], ['Mattermost', 'Mattermost'],
  ['メール通知', 'Email Notification'], ['ウェブフック', 'Webhook'],
  ['チャットボット', 'Chatbot'], ['バーチャルアシスタント', 'Virtual Assistant'],
  ['ナレッジマネジメント', 'Knowledge Management'], ['Wiki', 'Wiki'],
  ['Confluence', 'Confluence'], ['Notion', 'Notion'],
  ['Obsidian', 'Obsidian'], ['ドキュメントコラボレーション', 'Document Collaboration'],
  ['共同編集', 'Co-editing'], ['バージョン履歴', 'Version History'],
  ['変更追跡', 'Change Tracking'], ['コメント機能', 'Comment Feature'],
  ['メンション', 'Mention'], ['タグ付け', 'Tagging'],
  ['ラベリング', 'Labeling'], ['カテゴリ化', 'Categorization'],
  ['フォルダ管理', 'Folder Management'], ['ファイル共有', 'File Sharing'],
  ['アクセス権管理', 'Access Right Management'], ['共有リンク', 'Shared Link'],
  ['ダウンロード制限', 'Download Restriction'], ['有効期限', 'Expiration Date'],
  ['二段階認証', 'Two-Factor Authentication'], ['SSO連携', 'SSO Integration'],
  ['SCIM', 'SCIM'], ['ディレクトリ同期', 'Directory Sync'],
  ['ユーザープロビジョニング', 'User Provisioning'], ['デプロビジョニング', 'Deprovisioning'],
  ['グループ管理', 'Group Management'], ['チーム管理', 'Team Management'],
  ['組織管理', 'Organization Management'], ['テナント管理', 'Tenant Management'],
  ['マルチテナント', 'Multi-tenant'], ['シングルテナント', 'Single-tenant'],
  ['データ分離', 'Data Isolation'], ['リソース分離', 'Resource Isolation'],
  ['レート制限設定', 'Rate Limit Configuration'], ['スロットリング', 'Throttling'],
  ['バックプレッシャー', 'Backpressure'], ['サーキットブレーカー', 'Circuit Breaker'],
  ['リトライ戦略', 'Retry Strategy'], ['指数バックオフ', 'Exponential Backoff'],

  // Hardware & IoT (40)
  ['GPU', 'GPU'], ['TPU', 'TPU'], ['NPU', 'NPU'],
  ['FPGA', 'FPGA'], ['ASIC', 'ASIC'], ['CPU最適化', 'CPU Optimization'],
  ['メモリ管理', 'Memory Management'], ['キャッシュ階層', 'Cache Hierarchy'],
  ['NUMA', 'NUMA'], ['SSD', 'SSD'], ['NVMe', 'NVMe'],
  ['RAID', 'RAID'], ['ストレージティアリング', 'Storage Tiering'],
  ['オブジェクトストレージ', 'Object Storage'], ['ブロックストレージ', 'Block Storage'],
  ['ファイルストレージ', 'File Storage'], ['NFS', 'NFS'], ['iSCSI', 'iSCSI'],
  ['ファイバーチャネル', 'Fibre Channel'], ['InfiniBand', 'InfiniBand'],
  ['IoTデバイス', 'IoT Device'], ['エッジコンピューティング', 'Edge Computing'],
  ['フォグコンピューティング', 'Fog Computing'], ['IoTゲートウェイ', 'IoT Gateway'],
  ['センサーデータ', 'Sensor Data'], ['テレメトリ', 'Telemetry'],
  ['MQTT ブローカー', 'MQTT Broker'], ['デバイス管理', 'Device Management'],
  ['OTAアップデート', 'OTA Update'], ['ファームウェア', 'Firmware'],
  ['組み込みシステム', 'Embedded System'], ['RTOS', 'RTOS'],
  ['マイクロコントローラ', 'Microcontroller'], ['シングルボードコンピュータ', 'Single Board Computer'],
  ['Raspberry Pi', 'Raspberry Pi'], ['Arduino', 'Arduino'],
  ['デジタルツイン', 'Digital Twin'], ['予知保全', 'Predictive Maintenance'],
  ['状態監視', 'Condition Monitoring'], ['振動解析', 'Vibration Analysis'],

  // Internationalization & localization (30)
  ['国際化', 'Internationalization'], ['地域化', 'Localization'],
  ['文字エンコーディング', 'Character Encoding'], ['UTF-8', 'UTF-8'],
  ['Unicode', 'Unicode'], ['多言語サポート', 'Multilingual Support'],
  ['翻訳メモリ', 'Translation Memory'], ['用語集', 'Glossary'],
  ['ローカライゼーションキット', 'Localization Kit'], ['文化適応', 'Cultural Adaptation'],
  ['日付形式', 'Date Format'], ['通貨形式', 'Currency Format'],
  ['数値形式', 'Number Format'], ['タイムゾーン', 'Timezone'],
  ['RTL対応', 'RTL Support'], ['複数形処理', 'Pluralization'],
  ['性別対応', 'Gender Handling'], ['フォールバック言語', 'Fallback Language'],
  ['翻訳品質保証', 'Translation QA'], ['機械翻訳後編集', 'Post-Editing'],
  ['用語統一', 'Terminology Consistency'], ['スタイルガイド', 'Style Guide'],
  ['トランスクリエーション', 'Transcreation'], ['音訳', 'Transliteration'],
  ['字幕翻訳', 'Subtitle Translation'], ['ソフトウェアローカライゼーション', 'Software Localization'],
  ['ウェブサイトローカライゼーション', 'Website Localization'], ['コンテンツローカライゼーション', 'Content Localization'],
  ['マーケットリサーチ', 'Market Research'], ['ターゲット市場', 'Target Market'],
]

// Step 3: Add extra keywords (deduplicated)
for (const [jpName, enName] of extraKeywords) {
  const key = jpName.trim().toLowerCase()
  if (!uniqueKeywords.has(key)) {
    uniqueKeywords.set(key, {
      name: jpName,
      en_keyword: enName,
      description: `${enName} — RAG文書Q&Aに関連する用語`,
    })
  }
}

console.log(`After extra keywords: ${uniqueKeywords.size}`)

// Step 4: If still not enough, generate numbered variants in different domains
const domainPrefixes = [
  { jp: '高度', en: 'Advanced' }, { jp: '基本', en: 'Basic' },
  { jp: '応用', en: 'Applied' }, { jp: '実践', en: 'Practical' },
  { jp: '統合', en: 'Integrated' }, { jp: '自動', en: 'Automated' },
  { jp: '最適', en: 'Optimal' }, { jp: '次世代', en: 'Next-gen' },
  { jp: 'カスタム', en: 'Custom' }, { jp: 'エンタープライズ', en: 'Enterprise' },
  { jp: '分散型', en: 'Distributed' }, { jp: 'リアルタイム', en: 'Real-time' },
  { jp: 'クラウド型', en: 'Cloud-based' }, { jp: 'AI駆動', en: 'AI-driven' },
  { jp: 'データ連携', en: 'Data Integration' },
]
const baseSuffixes = [
  { jp: '分析', en: 'Analysis' }, { jp: '管理', en: 'Management' },
  { jp: '構築', en: 'Building' }, { jp: '運用', en: 'Operations' },
  { jp: '設計', en: 'Design' }, { jp: '開発', en: 'Development' },
  { jp: '最適化', en: 'Optimization' }, { jp: '監視', en: 'Monitoring' },
  { jp: '自動化', en: 'Automation' }, { jp: '統合', en: 'Integration' },
  { jp: 'テスト', en: 'Testing' }, { jp: 'デプロイ', en: 'Deployment' },
  { jp: '移行', en: 'Migration' }, { jp: '保守', en: 'Maintenance' },
  { jp: 'セキュリティ', en: 'Security' },
]

let prefixIdx = 0
let suffixIdx = 0
while (uniqueKeywords.size < TARGET_COUNT) {
  const prefix = domainPrefixes[prefixIdx % domainPrefixes.length]
  const suffix = baseSuffixes[suffixIdx % baseSuffixes.length]
  const jpName = `${prefix.jp}${suffix.jp}`
  const enName = `${prefix.en} ${suffix.en}`
  const key = jpName.trim().toLowerCase()

  if (!uniqueKeywords.has(key)) {
    uniqueKeywords.set(key, {
      name: jpName,
      en_keyword: enName,
      description: `${enName} — RAG文書Q&Aに関連する用語`,
    })
  }

  suffixIdx++
  if (suffixIdx % baseSuffixes.length === 0) {
    prefixIdx++
  }

  // Safety: prevent infinite loop
  if (prefixIdx >= domainPrefixes.length * 10) break
}

// Convert map to array
const kwRows = Array.from(uniqueKeywords.values())
console.log(`Generated ${kwRows.length} unique keyword rows (target: ${TARGET_COUNT})`)

const ws2 = XLSX.utils.json_to_sheet(kwRows)
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb2, ws2, 'Keyword Import')

const kwPath = path.join(__dirname, '..', 'glossary_keyword_import_sample.xlsx')
XLSX.writeFile(wb2, kwPath)
console.log(`Keyword import file: ${kwPath} (${kwRows.length} rows)`)
