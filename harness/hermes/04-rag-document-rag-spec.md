# Spec: RAG và Document RAG

## 1. Mục tiêu

Cho phép tenant ingest corpus tài liệu, tìm passages liên quan bằng lexical + semantic retrieval, rerank, đưa evidence vào model context và trả citation có thể kiểm chứng.

## 2. Phạm vi nguồn

MVP MUST hỗ trợ UTF-8 text, Markdown, HTML, PDF có text layer và DOCX. SHOULD hỗ trợ CSV, JSON, PPTX và OCR PDF/image qua parser plugin. Source có thể là upload, URL, object storage hoặc connector.

## 3. Pipeline

```text
Source → download/scan → parse → normalize → structure-aware chunk
       → embed → lexical/vector index → ready

Query → rewrite/expand → ACL filter → BM25 + vector search
      → RRF fusion → rerank → diversity/dedup → citation assembly
      → ContextBlock[]
```

## 4. Functional requirements

- `RAG-FR-001`: Ingestion asynchronous, idempotent theo tenant/source/content hash.
- `RAG-FR-002`: Giữ original binary, extracted text, parser version và checksum.
- `RAG-FR-003`: Chunk theo cấu trúc tự nhiên; không cắt giữa code block/table nếu có thể.
- `RAG-FR-004`: Embedding model/dimension/version được lưu với vector.
- `RAG-FR-005`: Hỗ trợ BM25/full-text và vector retrieval độc lập.
- `RAG-FR-006`: Hybrid retrieval dùng fusion deterministic.
- `RAG-FR-007`: Query filter theo tenant, collection, document metadata, ACL và freshness.
- `RAG-FR-008`: Reranker là optional adapter; fallback về fused rank.
- `RAG-FR-009`: Kết quả chứa source, page/section/offset và stable citation ID.
- `RAG-FR-010`: Update document tạo version mới và atomically đổi active version.
- `RAG-FR-011`: Delete/revoke ACL loại document khỏi retrieval trước khi background cleanup hoàn tất.
- `RAG-FR-012`: Retrieval có token budget và diversity theo document/source.
- `RAG-FR-013`: Evaluation dataset hỗ trợ query, relevant chunk/document và expected citation.
- `RAG-FR-014`: Prompt injection detection gắn risk metadata, không tự ý loại evidence nếu policy không yêu cầu.
- `RAG-FR-015`: Retrieval result có thể được cache theo query hash + ACL/version fingerprint.

## 5. Data model

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE collections (
  id text PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL,
  description text, embedding_profile text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, name)
);

CREATE TABLE documents (
  id text PRIMARY KEY, tenant_id text NOT NULL, collection_id text NOT NULL REFERENCES collections(id),
  source_uri text, media_type text NOT NULL, title text, active_version integer NOT NULL,
  acl jsonb NOT NULL DEFAULT '{}', metadata jsonb NOT NULL DEFAULT '{}',
  state text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  id text PRIMARY KEY, tenant_id text NOT NULL, document_id text NOT NULL REFERENCES documents(id),
  version integer NOT NULL, content_hash text NOT NULL, object_uri text NOT NULL,
  extracted_text_uri text, parser_name text, parser_version text, state text NOT NULL,
  error jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version), UNIQUE(tenant_id, document_id, content_hash)
);

CREATE TABLE chunks (
  id text PRIMARY KEY, tenant_id text NOT NULL, document_id text NOT NULL,
  document_version integer NOT NULL, ordinal integer NOT NULL,
  text text NOT NULL, token_count integer NOT NULL,
  page_start integer, page_end integer, section_path text[],
  char_start integer, char_end integer, metadata jsonb NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
  UNIQUE(document_id, document_version, ordinal)
);

CREATE TABLE chunk_embeddings (
  tenant_id text NOT NULL, chunk_id text NOT NULL REFERENCES chunks(id),
  profile text NOT NULL, dimension integer NOT NULL, embedding vector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(chunk_id, profile)
);
```

Vector column có thể tách theo embedding profile/dimension hoặc dùng external vector adapter nếu database yêu cầu fixed dimension.

## 6. Ingestion state machine

```text
uploaded → scanning → parsing → chunking → embedding → indexing → ready
             └→ quarantined
parsing/chunking/embedding/indexing → failed_retryable → queued
                                  └→ failed_terminal
ready → superseded | deleting → deleted
```

### Ingestion API

```text
POST /v1/collections
POST /v1/collections/{id}/documents        multipart hoặc source URI
GET  /v1/documents/{id}
GET  /v1/documents/{id}/versions
POST /v1/documents/{id}/reindex
DELETE /v1/documents/{id}
GET  /v1/ingestion-jobs/{id}
```

Upload response `202 Accepted` trả `document_id`, `version`, `job_id` và state.

## 7. Parsing và normalization

Parser contract:

```text
supports(media_type) -> bool
parse(BinaryRef, limits) -> ParsedDocument
```

`ParsedDocument` gồm title, language, ordered blocks, page/slide/sheet, headings, table/code markers và warnings.

Security limits mặc định:

- Maximum binary size theo tenant plan.
- Maximum decompressed size và archive depth.
- Parser chạy sandbox, không network, CPU/memory/time limit.
- Antivirus/content scan trước parse.
- Macro/script không được thực thi.

## 8. Chunking

Default:

```yaml
chunking:
  target_tokens: 900
  max_tokens: 1200
  overlap_percent: 15
  minimum_tokens: 80
  preserve: [heading_path, code_block, table, list]
```

Algorithm ưu tiên boundary: document section → heading → paragraph → sentence → token window. Overlap lấy các sentence cuối, không copy heading nhiều lần ngoài metadata. Chunk ID SHOULD content-addressed từ document version + normalized span.

## 9. Retrieval

Request:

```json
{
  "query": "What was decided about database migration?",
  "collection_ids": ["col_..."],
  "filters": {"language": "en"},
  "top_k": 8,
  "candidate_k": 50,
  "token_budget": 6000,
  "modes": ["lexical", "vector"],
  "rerank": true
}
```

Defaults:

- Query rewrite tạo tối đa 2 variants; original có weight 2.
- BM25 và vector chạy song song.
- Lấy tối đa 50 candidates mỗi mode trước dedup.
- Reciprocal Rank Fusion: `score(d)=Σ weight_i/(60+rank_i(d))`.
- Rerank tối đa top 30.
- Trả tối đa 8 passages, tối đa 3 passages/document trước khi diversity relaxation.
- Cắt theo token budget, không cắt mất citation span.

Response:

```json
{
  "query_id": "qry_...",
  "passages": [{
    "chunk_id": "chk_...",
    "document_id": "doc_...",
    "text": "...",
    "score": 0.82,
    "citation": {"id": "cit_...", "title": "...", "uri": "...", "page": 12, "section": "Migration"},
    "risk": {"prompt_injection": "low"}
  }],
  "partial": false,
  "timings_ms": {"lexical": 20, "vector": 35, "rerank": 180}
}
```

## 10. Generation grounding

- Retrieved text được bọc như evidence không đáng tin cậy về instruction.
- Model được yêu cầu chỉ dùng citation IDs đã cấp.
- Postprocessor kiểm tra citation tồn tại và passage hỗ trợ claim ở mức heuristic/entailment adapter.
- Nếu evidence không đủ, response phải nói không đủ dữ liệu thay vì suy đoán.
- Citation renderer cung cấp title, source URI và page/section khi có.

## 11. ACL và privacy

- ACL filter MUST được áp dụng trong database/vector query, không chỉ sau retrieval.
- Cache key chứa principal/ACL fingerprint.
- Revocation cập nhật deny index synchronously trước khi trả 200.
- Document encryption at rest dùng tenant/application keys theo deployment policy.
- Extracted text và embedding được coi cùng classification với document gốc.
- Delete request phải xóa object, text, chunks, vectors và cache; audit tombstone không chứa nội dung.

## 12. Freshness và consistency

- Chỉ active document version có state `ready` được truy xuất.
- Version mới chỉ activate sau khi lexical và vector indexes hoàn tất.
- Nếu embedding service lỗi, policy có thể activate lexical-only với `partial_index=true`.
- Reconciliation job so sánh document version, chunk count, vector count và object existence.

## 13. Evaluation

Offline metrics:

- Recall@K và Precision@K.
- MRR/nDCG.
- Citation precision/coverage.
- Answer groundedness.
- Retrieval latency và token cost.
- ACL leak rate bắt buộc bằng 0.

Corpus đánh giá MUST chứa exact keyword, paraphrase, multilingual, table, code, conflicting versions, revoked document và prompt-injection fixtures.

## 14. Observability

- `ingestion_jobs_total{state,parser}`
- `ingestion_duration_ms{stage}`
- `document_chunks_total{collection}`
- `retrieval_duration_ms{mode}`
- `retrieval_candidates_total{mode}`
- `retrieval_empty_total`
- `rerank_duration_ms{provider}`
- `citation_validation_total{outcome}`
- `rag_acl_filter_reject_total`

## 15. Tests và acceptance

- `RAG-AC-001`: Ingest cùng content hai lần không tạo duplicate active version.
- `RAG-AC-002`: PDF/DOCX fixture trả citation đúng page/section.
- `RAG-AC-003`: Update version atomically thay kết quả cũ bằng mới.
- `RAG-AC-004`: Revoked document không xuất hiện ngay cả khi cache còn entry.
- `RAG-AC-005`: Hybrid retrieval vượt baseline BM25/vector trên evaluation set đã khóa.
- `RAG-AC-006`: Parser bomb/malicious file bị quarantine trong resource limits.
- `RAG-AC-007`: Prompt injection trong chunk không thay đổi system/tool policy.
- `RAG-AC-008`: Reconciliation sửa hoặc báo chính xác missing vector/object.
