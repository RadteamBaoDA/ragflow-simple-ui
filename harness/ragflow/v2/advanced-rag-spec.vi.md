# Đặc tả logic Advanced RAG

Trạng thái: Bản nháp để đối chiếu tích hợp

Đối tượng đọc: Product, kiến trúc, backend, ML, data, QA và vận hành

Mục đích: Chuyển hành vi và workflow Advanced RAG của RAGFlow sang một ứng dụng khác mà không sao chép implementation.

## 1. Goal

Xây dựng một subsystem Advanced RAG lấy bằng chứng làm trọng tâm, có thể trả lời câu hỏi đơn giản và multi-hop trên tài liệu nội bộ, tùy chọn dùng web và dữ liệu có cấu trúc, đồng thời tạo citation truy vết được. Subsystem phải điều phối nghiên cứu trong giới hạn, thu thập và đối chiếu bằng chứng, truy vấn bổ sung đúng phần còn thiếu, rồi trả lời đầy đủ, trả lời một phần có cảnh báo hoặc từ chối trả lời.

Thiết kế hỗ trợ bốn mức reasoning bằng cùng một implementation:

- `low`: một lượt retrieval trực tiếp.
- `medium`: phân rã claim, retrieval song song và kiểm tra đủ bằng chứng.
- `high`: research agent theo từng claim với tool được kiểm soát.
- `ultra`: deep research, cho phép claim động và lập kế hoạch lại.

## 2. Kết quả mong muốn

- Mọi câu trả lời mang tính sự kiện đều truy ngược được về source chunk.
- Claim không có bằng chứng không được trình bày như sự thật.
- Câu hỏi phức tạp được chia thành các claim có thể xác minh độc lập.
- Thiếu bằng chứng dẫn đến follow-up query có mục tiêu, không lặp lại cùng một search.
- Artifact tạo lúc index giúp retrieval tốt hơn nhưng không trở thành dependency bắt buộc.
- `high` thường hoàn tất trong 30-60 giây; `ultra` có thể chạy 2-3 phút và phải stream tiến trình.
- Mọi vòng lặp đều có giới hạn cycle, thời gian, concurrency, token và chi phí.
- Subsystem tích hợp qua contract và adapter, không yêu cầu app đích sao chép class hoặc API của RAGFlow.

## 3. Phạm vi

### 3.1 Bao gồm

- Chunk tài liệu cơ sở, keyword index, embedding, metadata và provenance.
- Compilation structure, outline, entity/relation, mind map, RAPTOR, dataset navigation và wiki.
- Incremental compile, rebuild, deletion và trạng thái sẵn sàng của artifact.
- Chuẩn hóa câu hỏi, phân loại, pre-search, planning, orchestration, kiểm tra bằng chứng, tổng hợp câu trả lời, citation, streaming, cancellation và observability.
- Tool hybrid, vector, BM25, web, structured query, navigation, graph, wiki và inspector.
- Policy `low`, `medium`, `high` và `ultra`.
- Fallback an toàn khi source, model hoặc compiled artifact không khả dụng.

### 3.2 Không bao gồm

- Sao chép source hoặc public API shape của RAGFlow.
- Implementation đệ quy `DeepResearcher` đã bị vô hiệu hóa.
- Compatibility shim cho record, tuple shape, parser field hoặc compile keyword lịch sử của RAGFlow.
- Xây mới authentication, tenant, billing, UI ingestion hoặc model-provider platform.
- Tự động train hoặc fine-tune model.
- Bắt buộc tách microservice.

## 4. Nguyên tắc thiết kế

1. Bằng chứng trước độ trôi chảy: grounding quan trọng hơn văn phong.
2. Một engine, nhiều mode bằng policy: không tạo bốn runtime.
3. Retrieval từ thô đến tinh: thu hẹp corpus, điều hướng cấu trúc rồi mới đọc chi tiết.
4. Chọn đường đủ và rẻ nhất: dừng ngay khi bằng chứng đạt yêu cầu.
5. Tool phụ thuộc artifact: chỉ expose tool khi artifact cần thiết đã sẵn sàng.
6. Suy giảm an toàn: không có artifact nâng cao vẫn dùng retrieval cơ bản.
7. Provenance bất biến: artifact sinh ra luôn giữ liên kết về chunk gốc.
8. Tự chủ có giới hạn: agent và orchestrator đều có budget.
9. Indexing idempotent: compile lặp lại tạo cùng logical record.
10. Contract độc lập ứng dụng: storage, LLM, queue và search của app đích được nối qua adapter.

## 5. Mô hình hệ thống

Subsystem gồm hai plane có thể triển khai độc lập, nối bằng artifact catalog.

```text
Index plane
  source document -> parse/chunk/embed -> compile artifact -> artifact catalog

Query plane
  request -> formalize -> route -> pre-search -> plan -> research
          -> sufficiency -> follow-up/replan hoặc synthesize -> cited response

Bridge
  artifact catalog -> xác định tool đủ điều kiện và document scope
```

Implementation đầu tiên nên là modular monolith. Contract giữa module phải cho phép tách service sau này khi số liệu tải chứng minh cần thiết.

## 6. Domain contract cốt lõi

### 6.1 SourceDocument

- Document ID ổn định, dataset ID, tenant/security scope, title, metadata, content version và lifecycle state.
- Content version mới làm stale các artifact phụ thuộc.

### 6.2 SourceChunk

- Chunk ID ổn định, document ID, vị trí có thứ tự, text, token count, metadata, keyword fields, embedding tùy chọn và content hash.
- Chunk ID là citation anchor.

### 6.3 CompiledArtifact

- Artifact ID, loại, scope, source document/chunk IDs, compiler version, input hash, status, nội dung searchable, vector tùy chọn và timestamps.
- Loại artifact: `outline`, `page_index`, `mind_map`, `raptor_tree`, `dataset_navigation`, `knowledge_graph`, `wiki`.
- Status: `pending`, `building`, `ready`, `partial`, `failed`, `stale`, `deleting`.

### 6.4 EvidenceItem

- Evidence ID trong phạm vi request, source chunk ID, document ID, text, retrieval scores, source tool, query/claim ID và provenance.
- Evidence ID ổn định trong một request và ánh xạ citation cuối về source chunk.

### 6.5 ResearchPlan và Claim

- Plan type, danh sách claim có thứ tự, cycle budget và replan feedback tùy chọn.
- Mỗi claim chứa ID, mô tả, priority, suggested tools, verification state, confidence, evidence IDs, gaps, grounded facts, numeric facts và discovered claims.

### 6.6 SufficiencyVerdict

- Status: `SUFFICIENT`, `USEFUL_BUT_INCOMPLETE`, `INSUFFICIENT`, `CONFLICTING`.
- Score, claim coverage, grounding score, required-entity gaps, numeric conflicts, missing information, follow-up đề xuất và decision action.

## 7. Workflow indexing và knowledge compilation

### 7.1 Baseline indexing

App đích parse tài liệu, tạo chunk theo đúng thứ tự, tokenize nội dung searchable, tính embedding và lưu metadata/provenance. Advanced compilation chỉ bắt đầu sau khi baseline chunks đã được lưu bền vững.

### 7.2 Trigger và lifecycle compilation

Compilation chạy khi document được tạo/cập nhật, template hoặc cấu hình thay đổi, có yêu cầu rebuild, hoặc document bị xóa. Job ghi input hash, compiler version, artifact types, progress, warning và final status. Chạy lại input không đổi phải là no-op.

Artifact type bị lỗi không rollback loại đã thành công. Nó chuyển thành `failed` hoặc `partial`, và query-time gating sẽ ẩn tool phụ thuộc.

### 7.3 Structure compilation

Xử lý các batch chunk giới hạn theo token bằng extraction template cấu hình được. Logical output hỗ trợ list, set, timeline, entity, relation và hypergraph. Chuẩn hóa kết quả, gắn source chunk IDs, embed searchable rows, deduplicate cục bộ rồi merge ở document hoặc dataset scope. Rebuild graph phục vụ hiển thị/điều hướng sau commit.

### 7.4 RAPTOR compilation

Embed các chunk theo thứ tự, nhóm nội dung liền kề có ngữ nghĩa gần nhau, tóm tắt từng nhóm rồi lặp trên summary cho tới root layer có giới hạn. Mỗi summary node mang toàn bộ source chunk IDs phía dưới. Lưu cả hierarchy và summary node searchable.

### 7.5 Mind-map và outline compilation

Trích xuất concept hierarchy đã deduplicate từ các section được giới hạn token. Giữ document scope và source references. Lưu như dữ liệu navigation; không coi node là bằng chứng sự kiện có thẩm quyền nếu không resolve được về source chunk.

### 7.6 Dataset navigation

Tạo document-level summary và embedding, đặt document vào cluster gần nhất hoặc tạo cluster mới khi similarity không đủ. Split cluster quá lớn và xóa cluster rỗng. Dùng lock theo dataset khi update đồng thời. Kết quả dùng để route query tới candidate documents trước retrieval chi tiết.

### 7.7 Knowledge graph compilation

Trích xuất canonical entity và relation, giữ alias cùng source chunks, embed field searchable và deduplicate theo scope. Relation không có endpoint được grounding phải bị loại hoặc đánh dấu incomplete. Graph chỉ hỗ trợ exploration; fact trả về vẫn phải resolve được về source evidence.

### 7.8 Wiki compilation

Workflow logic:

1. MAP: trích entity, relation, concept, claim, topic và source chunk IDs theo batch.
2. REDUCE: canonicalize và merge item tương đương.
3. PLAN: tùy chọn nhóm tri thức thành page.
4. REFINE: sinh, cập nhật hoặc re-synthesize page từ source chunks.
5. FINALIZE: kiểm tra link, gắn topic, lưu page searchable và rebuild page graph.

Incremental update so sánh content hash, xử lý lại chunk đổi, xóa provenance đã mất, route tri thức mới vào page hiện hữu và chỉ re-synthesize khi vượt growth threshold.

### 7.9 Deletion

Xóa document phải xóa hoặc cập nhật mọi artifact tham chiếu đến nó. Entity, cluster và wiki page dùng chung chỉ tồn tại nếu vẫn còn document khác hỗ trợ. Deletion phải idempotent và audit được.

## 8. Artifact catalog và tool gating

Khi query bắt đầu, dựng artifact-readiness map theo dataset và document. Tool eligibility là giao của mode policy, source được cấu hình, security scope, artifact readiness, research phase hiện tại và request context.

| Nhóm tool | Capability/artifact bắt buộc |
|---|---|
| Hybrid/vector/BM25 | Baseline chunks và index tương ứng |
| Web search | Web provider được cấu hình và request có quyền |
| Structured query | Structured schema và query adapter |
| Dataset navigation | Dataset-navigation rows ở trạng thái ready |
| Outline/ontology navigation | Outline, page index, mind map hoặc RAPTOR tree |
| Graph exploration | Knowledge graph ready và đã có entity/context |
| Wiki query | Wiki page searchable ở trạng thái ready |
| Inspector | Source chunks truy cập được trong security scope |

Tool không khả dụng phải bị loại khỏi agent schema thay vì được expose rồi chắc chắn thất bại.

## 9. Workflow query-time

### 9.1 Khởi tạo request

Kiểm tra identity và quyền dataset/document. Resolve model, data-source adapters, reasoning mode, language, metadata filters, attachments, budgets và cancellation handle. Tạo evidence pool và trace rỗng trong phạm vi request.

### 9.2 Chuẩn hóa câu hỏi

Biến lượt hỏi cuối cùng cùng conversation history có giới hạn thành câu hỏi độc lập và retrieval keywords gọn. Giữ nguyên entity, date, number, constraint và answer type. Nếu lỗi, dùng câu hỏi gốc.

### 9.3 Route

Phân loại factual, comparative, procedural, analytical hoặc exploratory. Xác định decomposition có hữu ích hay không và ghi expected answer shape. Reasoning mode được chọn sẽ cố định execution-strategy family; router chỉ thích nghi planning bên trong family đó và không tự động chuyển mode.

### 9.4 Preliminary search

Với mode có decomposition, chạy một hybrid search giới hạn trước planning. Mục đích là grounding việc tạo claim và seed citation. Direct mode bỏ qua để tránh retrieval trùng.

### 9.5 Planning

Tạo các claim có thể xác minh độc lập. Giới hạn claim ban đầu: low 1, medium 3, high 5, ultra 8. Comparative plan phải bao phủ mọi subject và comparison dimension. Procedural plan bao phủ prerequisite, ordered steps, constraint và outcome. Replan phải xử lý feedback thiếu dữ liệu trước đó và tránh claim tương đương.

### 9.6 Execution policy

#### Low

Chạy một đường hybrid/BM25 retrieval trực tiếp, merge evidence rồi synthesize. Không có agent loop hoặc sufficiency retry.

#### Medium

Search claim trong batch song song có giới hạn. Cross-check từng claim, tính sufficiency và chạy follow-up đúng phần thiếu trong cycle budget. Không có autonomous tool loop.

#### High

Giao claim chưa verified cho research agent có giới hạn. Agent đi từ thô đến tinh, chỉ dùng tool đã gate và trả structured report. Mặc định tối đa hai agent song song và hai agent cycle trên mỗi claim. Sau mỗi orchestrator cycle phải có LLM-assisted sufficiency check.

#### Ultra

Dùng workflow high cộng dynamic claim discovery, replanning, tool compiled-artifact mở rộng và tối đa ba agent song song. Claim mới phải mới, liên quan đến top-level answer và nằm trong global claim budget.

## 10. Research-agent loop

Mỗi agent nhận một claim, context liên quan, tool schemas khả dụng, evidence đã thu thập và hard budgets. Agent có thể reason, gọi tool, inspect evidence trả về và kết thúc bằng structured report.

Loop hỗ trợ native function calling và text-tool fallback. Tool arguments phải được validate. Các call độc lập trong cùng model turn có thể chạy song song. Navigation result phải được kiểm tra sufficiency trước khi cho phép search rộng hơn. Sinh terminal report sẽ kết thúc loop.

Report bắt buộc có: claim ID, report, verified flag, confidence, evidence IDs, grounded facts, numeric facts, gaps và discovered claims.

## 11. Semantics của retrieval và navigation

- Hybrid search kết hợp keyword và vector, trả source chunk và deduplicate bằng chunk ID ổn định.
- Vector search chỉ semantic; BM25 chỉ lexical.
- Web result được tách như external source và mang URL provenance.
- Structured query dịch câu hỏi qua schema adapter có kiểm soát, trả natural-language result và provenance rows.
- Dataset navigation trả document IDs và cập nhật downstream document scope.
- Outline, mind map và RAPTOR navigation trả source-backed passages trong selected documents.
- Graph exploration bắt đầu từ entity đã biết và trả relation có source chunks.
- Wiki query tìm compiled pages nhưng citation resolve về chunk gốc.
- Inspector mở rộng chunk, lấy chunk liền kề, grep document hoặc so sánh source mà không mở rộng global scope.

Search tương đương lặp lại trong một request phải dùng cache. Query khác explicit number hoặc constraint quan trọng không được coi là tương đương.

## 12. Quản lý evidence và sufficiency

Mọi tool result được merge vào một evidence pool đã deduplicate. Summary, graph edge và wiki page sinh ra không thể trở thành citation cuối nếu không resolve về source chunk.

Với từng claim, phải kiểm tra:

- cited evidence ID tồn tại;
- grounded fact xuất hiện trong cited text;
- required entity có mặt;
- số liệu được hỗ trợ và không mâu thuẫn;
- report trả lời claim thay vì bridge entity;
- độ đa dạng bằng chứng đủ khi cần xác nhận chéo nguồn.

Kết hợp deterministic checks, agent confidence, claim coverage và LLM context sufficiency judge. Conflict cứng về provenance, entity hoặc numeric phải override đánh giá tích cực từ LLM.

Decision ladder:

- `ANSWER_FULL`: đủ bằng chứng và không có hard conflict.
- `CONTINUE`: targeted query có thể đóng gap trong budget.
- `ANSWER_PARTIAL`: có bằng chứng hữu ích nhưng tiến triển dừng hoặc hết budget.
- `ABSTAIN`: không có bằng chứng đáng tin cho answer được yêu cầu.

Dừng sớm sau các cycle liên tiếp không tăng score đáng kể.

## 13. Tổng hợp câu trả lời và citation

Trước generation, thiết lập answer-target contract mô tả entity, value hoặc outcome thực sự được hỏi và entity nào chỉ là intermediate clue. Chọn evidence hữu ích, giữ passage có số liệu và giới hạn evidence độc lập với maximum context của model.

Câu trả lời phải:

- dùng ngôn ngữ của người hỏi nếu không có yêu cầu khác;
- phân biệt fact được hỗ trợ, uncertainty và missing information;
- có inline citation marker ánh xạ về source chunk;
- không cite internal plan, model reasoning hoặc compiled summary không có nguồn;
- nêu rõ insufficiency thay vì dùng model memory lấp khoảng trống;
- có cảnh báo partial answer khi thích hợp.

## 14. Streaming contract

Expose semantic event độc lập transport:

- `research_started`
- `question_formalized`
- `route_selected`
- `pre_search_completed`
- `plan_created`
- `claim_started` / `claim_completed`
- `tool_started` / `tool_completed`
- `sufficiency_checked`
- `replan_started`
- `answer_delta`
- `answer_completed`
- `research_failed` / `research_cancelled`

Progress text có thể hiển thị như status/reasoning stream, nhưng không yêu cầu hoặc lưu private chain-of-thought.

## 15. Budget, lỗi và fallback

Budget cấu hình theo mode: orchestrator cycles, agent cycles, parallel agents, claims, tool calls, retrieved chunks, context tokens, elapsed time và estimated cost.

Lỗi phải được cô lập theo claim và tool. Chỉ retry lỗi provider/storage tạm thời với bounded backoff. JSON LLM không hợp lệ được repair một lần rồi dùng deterministic fallback. Advanced artifact lỗi phải fallback về basic search. Cancellation lan tới model call, tool và compilation job. Partial result vẫn phải giữ provenance.

Mục tiêu mặc định:

- `high`: 3 orchestrator cycles, 2 agent cycles, 2 parallel agents, mục tiêu 30-60 giây.
- `ultra`: 4 orchestrator cycles, 2 agent cycles, 3 parallel agents, trần 2-3 phút.

## 16. Security và privacy

- Áp dụng quyền tenant, dataset, document và row trước retrieval và trước khi emit citation.
- Không mở rộng document scope vượt quyền của caller.
- Coi document text, tool output, web page và compiled artifact là prompt content không đáng tin.
- Structured query dùng allowlisted schema, read-only execution, parameterization, row limit và timeout.
- Log ID, stage, count, duration, score và error; không log document body, prompt chứa dữ liệu nhạy cảm, credential hoặc private model reasoning.

## 17. Observability

Tạo correlation ID cho mỗi request và compilation job. Thu thập mode, route, plan size, tool availability, tool trace, retrieval count/score, cache hit, evidence-pool size, sufficiency decision, cycle count, model/token usage, latency, fallback reason, cancellation và final outcome.

Quality metrics đề xuất:

- citation precision và coverage;
- grounded-claim rate;
- answer-target correctness;
- retrieval recall trên labeled questions;
- unsupported-number rate;
- abstention correctness;
- số cycle và tool call trung bình theo mode;
- latency và cost theo stage;
- artifact readiness và compilation failure rate.

## 18. Chiến lược validation

### Unit

Test routing fallback, plan normalization, tool gating, scope propagation, evidence deduplication, numeric/entity check, sufficiency decision, citation mapping, budget enforcement và deletion semantics.

### Integration

Test từng storage/model/search adapter; compile và retrieve mọi artifact type; kiểm tra incremental update/delete; kiểm tra quyền web/SQL; kiểm tra cancellation và timeout propagation.

### End-to-end

Dùng scenario factual, comparative, procedural, multi-hop, conflicting, missing-answer, multilingual và explicit-document-summary. Chạy trên mọi mode và assert response status, claim coverage, citation, latency ceiling và không dùng evidence trái quyền.

### Evaluation gate

Không enable một mode ở production trước khi grounded-answer và citation metrics tốt hơn baseline RAG mà không làm latency hoặc cost suy giảm ngoài ngưỡng chấp nhận.

## 19. Workflow triển khai

1. Định nghĩa adapter và domain contract cho app đích.
2. Thiết lập baseline retrieval, evidence pool, citation resolver và evaluation set.
3. Thêm compilation lifecycle và artifact catalog.
4. Thêm structure, RAPTOR, mind map và dataset navigation.
5. Thêm wiki và knowledge graph.
6. Thêm formalize, route, pre-search, planner và orchestration `low/medium`.
7. Thêm gated research-agent loop và `high`.
8. Thêm dynamic claims, replanning, tool mở rộng và `ultra`.
9. Thêm streaming, operational budget, dashboard và production gate.

Mỗi bước phải deploy và test độc lập; bước sau không được tạo retrieval engine thứ hai.

## 20. Acceptance criteria

- Bốn mode chạy qua một workflow điều khiển bằng policy.
- Mọi citation resolve về source chunk/document có quyền truy cập.
- Thiếu compiled artifact sẽ loại tool phụ thuộc nhưng giữ baseline search.
- High/ultra trả structured claim report và tuân thủ budget.
- Sufficiency hỗ trợ full, continue, partial và abstain.
- Numeric conflict và thiếu required entity chặn full-answer verdict.
- Incremental document update chỉ invalidate/rebuild artifact bị ảnh hưởng.
- Xóa document loại provenance của nó khỏi shared artifact.
- Streaming emit lifecycle event có thứ tự và terminal outcome.
- Cancellation dừng active work và giữ terminal state audit được.
- Evaluation bao phủ mọi retrieval source, artifact type, mode và failure path.

## 21. Ranh giới với Adaptive RAG

Đặc tả này triển khai Advanced Agentic RAG với artifact-aware retrieval. Mode được chọn bởi request hoặc application policy. Bên trong ceiling đó, routing, tool selection, follow-up retrieval, early stopping và replanning mang tính adaptive.

Adaptive RAG tự động hoàn toàn là policy layer bổ sung sau này: tự chọn mode ban đầu rẻ nhất và chỉ escalation khi bằng chứng chưa đủ. Nó không bắt buộc để đạt parity hành vi và không được tạo orchestration implementation thứ hai.

## 22. Contract tích hợp

App đích có thể dùng bất kỳ transport nào nhưng phải giữ các logical operation sau.

### 22.1 Compile request

Input: document ID, content version, dataset/security scope, artifact types cần tạo, template/configuration version và rebuild flag. Output: compilation job ID và artifact types được chấp nhận. Status lookup trả trạng thái từng artifact, progress, warning, error category, input hash, compiler version và timestamps.

### 22.2 Research request

Input: conversation messages, dataset/document scope đã được cấp quyền, metadata filters, reasoning mode, language, external source được bật, attachment references, generation settings và budget override tùy chọn. Server sở hữu identity và authorization; client không thể mở rộng scope bằng request field.

### 22.3 Research response

Terminal response chứa answer text, outcome (`full`, `partial`, `abstained`, `failed`, `cancelled`), citations, referenced documents, request ID, mode, usage, elapsed time và public trace summary tùy chọn. Streaming dùng event ở Phần 14 và luôn emit đúng một terminal event.

### 22.4 Adapter bắt buộc

- Document repository: tải document có quyền, metadata, version và ordered chunks.
- Search store: keyword, dense-vector, filtered, graph/wiki-artifact, upsert và delete operations.
- LLM provider: chat, streaming chat, structured output, token limits, cancellation và usage.
- Embedding provider: batch encoding kèm dimension metadata.
- Structured-data adapter: schema discovery và read-only query execution.
- Web-search adapter: query và normalized result provenance.
- Job runtime: enqueue, progress, cancellation, retry và terminal status.
- Artifact catalog: readiness lookup, dependency tracking, invalidation và lifecycle transition.

## 23. Bản đồ file RAGFlow tham khảo

Các file sau chỉ dùng tham khảo hành vi; implementation phải được thiết kế theo contract trong spec này.

- `rag/advanced_rag/agentic_rag.py`
- `rag/advanced_rag/agentic_rag_graph.py`
- `rag/advanced_rag/think_log.py`
- `rag/advanced_rag/harness/config.py`
- `rag/advanced_rag/harness/types.py`
- `rag/advanced_rag/harness/route.py`
- `rag/advanced_rag/harness/planner.py`
- `rag/advanced_rag/harness/pipeline.py`
- `rag/advanced_rag/harness/agent.py`
- `rag/advanced_rag/harness/sufficiency.py`
- `rag/advanced_rag/harness/sufficiency_ladder.py`
- `rag/advanced_rag/harness/orchestrator/`
- `rag/advanced_rag/harness/tools/`
- `rag/advanced_rag/harness/prompts/`
- `rag/advanced_rag/knowlege_compile/_common.py`
- `rag/advanced_rag/knowlege_compile/runner.py`
- `rag/advanced_rag/knowlege_compile/structure.py`
- `rag/advanced_rag/knowlege_compile/raptor.py`
- `rag/advanced_rag/knowlege_compile/mind_map_extractor.py`
- `rag/advanced_rag/knowlege_compile/dataset_nav.py`
- `rag/advanced_rag/knowlege_compile/wiki.py`
- `rag/advanced_rag/knowlege_compile/wiki_incremental.py`

Legacy bị loại rõ ràng:

- `rag/advanced_rag/tree_structured_query_decomposition_retrieval.py`
