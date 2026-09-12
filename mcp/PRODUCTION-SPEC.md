# Spec yêu cầu: RAG MCP Server, MCP Management và MCP Client

Ngày: 2026-09-12. Đối tượng: coding agent mới, không có ngữ cảnh dự án.

## 1. Mục tiêu và quy ước

- Đây là spec độc lập, không suy ra tính năng, kiến trúc hoặc mức độ hoàn thiện từ codebase hiện tại. Không phải implementation plan.
- Xây MCP server bằng TypeScript strict, Node.js 22+ thuộc dòng còn được hỗ trợ tại thời điểm triển khai; hỗ trợ ứng dụng RAG đa tenant.
- MCP server là một service/model riêng, đóng gói và deploy bằng Docker độc lập với App. Server không truy cập trực tiếp database, vector index, object storage, queue hoặc secret store nội bộ của App.
- MCP server gọi App qua API nội bộ được version hóa, xác thực service-to-service bằng system API key riêng. System API key chỉ định danh MCP service; nó không mang tenant, role, scope hoặc quyền dữ liệu của người dùng.
- Mỗi MCP request phải có user access token từ MCP client hoặc App session theo flow được hỗ trợ. MCP server chuyển user token nguyên trạng tới App API qua kênh bảo mật; App API là policy-enforcement point cuối cùng, tự xác thực token và tự xác minh tenant, membership, scope và ACL cho từng API call. App không tin `tenantId`, `role`, `userId` hoặc permission assertion do MCP server/client gửi.
- Bổ sung backend quản lý MCP và trang quản trị tại khu vực `admin/system`, làm việc theo tenant hiện tại.
- MCP client là thành phần backend kết nối MCP server bên ngoài để dùng trong RAG/agentic; đồng thời cung cấp hướng dẫn kết nối cho client bên ngoài gọi RAG MCP server của hệ thống.
- “Conversation” được hiểu là hội thoại nhiều lượt. Chuyển đổi định dạng tài liệu thuộc ingestion, không phải nghĩa của conversation.
- Mọi yêu cầu có ID bên dưới là bắt buộc để đạt phạm vi production, trừ mục ghi rõ tùy chọn. Các con số là mục tiêu nghiệm thu của sản phẩm, không phải tuyên bố hiệu năng đã đo.
- Coding agent tự kiểm chứng hiện trạng sau này, ánh xạ từng ID thành `đã có / thiếu / có nhưng không đạt / không áp dụng có lý do`, kèm bằng chứng và lập plan riêng. Không coi tính năng đang tồn tại là mặc nhiên an toàn.
- Các tên function là hợp đồng năng lực logic; không bắt buộc tên class, route, bảng dữ liệu hoặc framework nội bộ.

## 2. Ranh giới chức năng

| Thành phần | Trách nhiệm |
| --- | --- |
| RAG MCP Server | Công bố công cụ RAG, xác thực caller, phân quyền dữ liệu, thực thi retrieval/answer/conversation/agentic và trả kết quả chuẩn hóa |
| MCP Management | Quản lý endpoint được công bố, kết nối outbound, credential, policy, quyền, quota, audit và vận hành theo tenant |
| MCP Client | Discovery, authentication, gọi công cụ/resource được cho phép, kiểm soát kết nối và kết quả từ server bên ngoài |
| RAG backend | Ingestion, index, retrieval, generation, conversation và job; cung cấp khả năng cho MCP server qua hợp đồng rõ ràng |

- BND-01: Phân biệt endpoint MCP inbound của hệ thống với connection MCP outbound. Credential, policy, trạng thái và audit của hai chiều không dùng chung ngầm định.
- BND-02: Control plane quản trị và data plane MCP có quyền riêng. Quyền quản lý MCP không tự động cho phép đọc mọi tài liệu.
- BND-03: Không mặc định làm public registry, tự chạy mã do tenant cung cấp, tự cài package MCP, hoặc federation liên tenant. Những khả năng này ngoài phạm vi.
- BND-04: MCP service dùng API gateway/internal App API duy nhất. App API kiểm tra đồng thời system API key của MCP service và user access token trong mọi lệnh tenant-scoped; thiếu, sai audience, tenant không khớp hoặc quyền không đủ phải fail closed.
- BND-05: System API key chỉ được phép gọi App API được allowlist theo service identity. Không dùng key này để impersonate user, bypass RBAC/ACL, chọn tenant tùy ý, hoặc truy cập endpoint quản trị App.

## 3. MCP Server — protocol và authentication

### 3.1 Protocol

- SRV-01: Hỗ trợ remote MCP qua HTTPS Streamable HTTP và MCP `2026-07-28`; JSON-RPC 2.0, `server/discover`, protocol-version/capability metadata trên từng request, và result `resultType`. Không dùng `initialize`, `notifications/initialized` hoặc `Mcp-Session-Id` đã bị loại bỏ.
- SRV-02: Hỗ trợ `tools/list`, `tools/call`; mỗi tool có mô tả, input schema, output schema khi áp dụng và annotation đúng hành vi. Annotation không thay cho authorization.
- SRV-03: Công bố resources/resource templates cho tài nguyên đọc và prompts cho mẫu RAG nếu capability tương ứng được bật; không công bố capability chưa thực hiện.
- SRV-04: Discovery trả catalog công khai/deterministic theo tenant endpoint, không personalization theo connection/session. MCP service có thể ẩn capability bị global policy tắt, nhưng App API phải kiểm tra user quyền lại trên mọi tools/call, resources/read và action sau policy thay đổi.
- SRV-05: Danh sách lớn có pagination; giới hạn payload, page size và kết quả. Tool output có structured content với schema version, kèm text tương thích nếu client cần.
- SRV-06: Phân biệt lỗi JSON-RPC/protocol với tool execution error; mã lỗi nghiệp vụ ổn định, có request ID, retryable và thông tin an toàn. Không biến lỗi hệ thống thành kết quả retrieval rỗng.
- SRV-07: Hỗ trợ timeout, cancellation và progress theo capability negotiated. Progress không mặc nhiên được coi là token streaming. Answer có thể stream ở giao diện ứng dụng riêng; MCP phải có kết quả cuối hợp lệ.
- SRV-08: Long-running run có handle bền vững và tool get/status/cancel. MCP Tasks chỉ là tùy chọn khi phiên bản và hai đầu hỗ trợ; không phụ thuộc extension để hoàn tất flow.
- SRV-09: Protocol là stateless; không suy principal, tenant, capability, conversation hoặc state từ connection/stream. Conversation, run, ingestion job và approval dùng handle server-minted explicit, có TTL và được App API authorize lại ở mỗi call; auth được kiểm tra mỗi HTTP request.
- SRV-11: Streamable HTTP kiểm tra header chuẩn và body `_meta` nhất quán; mỗi request mang `io.modelcontextprotocol/protocolVersion`, client capabilities và client information khi client hỗ trợ. Kết quả trả server information trong `_meta`; mismatch dùng error MCP chuẩn.
- SRV-12: List/read response dùng `ttlMs` và `cacheScope`; dữ liệu tenant/user phải `private`. Không dùng shared cache/public scope cho discovery hoặc resource có policy/credential khác nhau.
- SRV-13: Hỗ trợ `subscriptions/listen` chỉ khi có nhu cầu thông báo; notification gắn subscription ID và không mang dữ liệu vượt ACL. Không dùng SSE resume/Last-Event-ID; stream đứt là request mới với request ID mới.
- SRV-10: Công bố ma trận client/transport/version được kiểm thử. STDIO chỉ tùy chọn cho môi trường local tin cậy; không chạy command tùy ý từ giao diện quản trị.

### 3.2 SSO và API key

- AUTH-01: SSO dựa trên OIDC với identity provider được tin cậy; nếu cần SAML thì qua identity broker. MCP HTTP đóng vai trò protected resource, sử dụng OAuth authorization phù hợp MCP, tách khỏi browser session của trang admin.
- AUTH-02: Hỗ trợ authorization server discovery, protected resource metadata và challenge chuẩn. Chọn authorization server/library đã được duy trì; không tự thiết kế giao thức cấp token.
- AUTH-03: Authorization Code + PKCE cho interactive client; kiểm tra state, redirect URI chính xác và nonce khi dùng OIDC. Hỗ trợ chính sách MFA/conditional access từ IdP.
- AUTH-04: Kiểm tra issuer, audience/resource, chữ ký hoặc introspection, expiry, not-before và scope. Không chấp nhận ID token như access token; không chuyển access token inbound sang downstream service.
- AUTH-05: Mapping user/service account sang tenant membership được backend xác minh. Không tự cấp tenant admin dựa trên email domain hoặc claim chưa được tin cậy.
- AUTH-06: API key dành cho automation là cơ chế riêng của sản phẩm, không tuyên bố mọi MCP client hỗ trợ. Document rõ header và client tương thích; không truyền key trong URL, prompt hoặc cookie.
- AUTH-07: Key gắn duy nhất tenant, owner/service account, scope, thời hạn, quota và tùy chọn IP allowlist. Hiển thị secret một lần; lưu verifier bằng hash/HMAC thích hợp, chỉ giữ prefix/fingerprint cho tra cứu.
- AUTH-08: Tạo, liệt kê metadata, rotate, revoke key; theo dõi last-used; hỗ trợ khoảng overlap rotation có hạn. Không có API lấy lại plaintext key.
- AUTH-09: Chặn credential hết hạn, revoked, owner bị khóa, tenant bị khóa hoặc membership bị gỡ. Thu hồi có hiệu lực trong tối đa 60 giây, bao gồm session đang mở và run trước bước tiếp theo.
- AUTH-10: Quyền hiệu lực là giao của principal, tenant policy, credential scopes, tool allowlist và ACL tài nguyên. Reject request đưa đồng thời nhiều credential gây nhập nhằng.
- AUTH-11: Các scope tối thiểu: `rag:retrieve`, `rag:answer`, `conversation:read`, `conversation:write`, `agent:run`, `run:read`, `run:cancel`, `knowledge:read`, `knowledge:write`. Quyền quản trị MCP tách riêng, không mở thành tool mặc định.
- AUTH-12: Với OAuth IDE/client, API resource indicator là canonical URI MCP endpoint; token phải có audience/resource cho MCP server. MCP service chỉ chuyển token tới App API khi App được xác định rõ là token-exchange/delegation audience hợp lệ; nếu không có delegation contract, App API tự xác thực token do cùng authorization server cấp cho App resource. Không forward token sang MCP server/provider bên thứ ba.
- AUTH-13: App API không chấp nhận user token chỉ vì MCP system API key hợp lệ. Một App API tenant-scoped cần cả service identity được allowlist và user identity hợp lệ; service identity bị revoke phải khóa toàn bộ call ngay cả khi user token còn hiệu lực.
- AUTH-14: IdP lifecycle phải đồng bộ disable/deprovision/group-membership về App authorization store trong SLA 60 giây hoặc App phải introspect token/membership trước request nhạy cảm. Thu hồi hủy stream/run ở checkpoint, vô hiệu cache quyền và approval chờ; không tuyên bố có thể thu hồi dữ liệu đã gửi cho IDE/client.

## 4. MCP Server — chức năng RAG

### 4.1 Knowledge base và ingestion

- KB-01: Liệt kê knowledge base/document được phép, đọc metadata/trạng thái ingestion và phiên bản index; hỗ trợ pagination, filter, tìm kiếm metadata.
- KB-02: Hỗ trợ ingest tài liệu, cập nhật, xóa, reindex và theo dõi job; chỉ bật write tool khi policy cho phép. Mặc định endpoint RAG chỉ đọc dữ liệu và tạo answer/run.
- KB-03: Ingestion có kiểm tra loại/kích thước file, malware, archive/decompression limit, parsing timeout, OCR theo cấu hình, chunking và embedding version có thể truy vết.
- KB-04: Upload/connector ingestion có idempotency, deduplication, trạng thái queued/running/succeeded/failed/cancelled, lỗi theo tài liệu và retry có giới hạn.
- KB-05: Không trả index đang xây dở như index hoàn chỉnh. Có trạng thái freshness; khi thay embedding/chunking phải quản lý version và đổi index an toàn.
- KB-06: Xóa hoặc thu hồi quyền phải chặn retrieval ngay trong giới hạn thu hồi quy định; làm sạch index, cache, bản sao và dữ liệu liên quan theo retention. Backup đã xóa phải có cơ chế áp lại tombstone khi restore.
- KB-07: App là source of truth của ACL. Đồng bộ ACL connector phải có version/freshness deadline, xử lý group/deny/inheritance và fail closed khi stale; áp dụng cùng ACL cho retrieval, citation, download, conversation history và agent context.
- KB-08: Parser/OCR/converter chạy sandbox/quarantine quyền tối thiểu, giới hạn CPU/RAM/disk/time, không có network mặc định và không mang secret App; file lỗi hoặc nghi malware không được index hay phát lộ cho model.

### 4.2 Retrieval chỉ trả chunk

- RET-01: `retrieveChunks(query, filters, options)` hỗ trợ lexical, vector và hybrid search; chọn strategy trong danh sách tenant cho phép, filter knowledge base/document/metadata/ngôn ngữ, topK và score threshold có giới hạn.
- RET-02: `adaptiveRetrieveChunks(query, filters, options)` tự chọn strategy, rewrite/decompose query, truy hồi nhiều lượt, đánh giá độ đủ bằng chứng, rerank, deduplicate và dừng theo budget/độ đủ/không tiến triển.
- RET-03: Cả hai function chỉ trả danh sách chunk trong trường `chunks` cùng metadata vận hành. Tuyệt đối không có generated answer, tổng hợp câu trả lời, assistant message hoặc tự ghi một lượt trả lời vào conversation.
- RET-04: Adaptive có thể dùng LLM để route/rewrite/chấm mức liên quan nhưng không dùng synthesis để tạo câu trả lời. Mọi lượt đều áp cùng tenant và ACL; rewrite không thể mở rộng quyền.
- RET-05: Mỗi chunk gồm chunkId, documentId, knowledgeBaseId, content, source reference, vị trí page/section/offset khi có, version, rank và thông tin score có tên strategy. Không giả định score của các strategy cùng thang đo.
- RET-06: Metadata gồm requestId, strategy thực dùng, số lượt, latency, usage/cost khi đo được, truncated, index freshness và stopReason. Không lộ chain-of-thought, prompt nội bộ hoặc query chứa dữ liệu nhạy cảm trong log mặc định.
- RET-07: Kết quả không có bằng chứng hợp lệ là `chunks: []` với lý do rõ ràng. Phân biệt no_matches, insufficient_evidence, budget_exhausted, dependency_failed và cancelled; chỉ trả partial khi caller chấp nhận và có cờ partial.
- RET-08: Kiểm tra ACL trước khi dữ liệu vào reranker/LLM, sau retrieval trước trả kết quả và trước đọc cache. Cache key gồm tenant, phạm vi quyền, query/filter, index và model version.
- RET-09: Có thể nhận conversation context theo quyền để giải nghĩa query; phải là tùy chọn explicit. Context không biến output retrieval thành answer.

### 4.3 Full answer flow và conversation

- ANS-01: `answerQuestion(question, context, options)` xử lý trọn luồng: validate → authorize → resolve conversation → retrieval → context selection → generation → citation validation → persist theo policy → trả kết quả cuối.
- ANS-02: Hỗ trợ chọn knowledge base, retrieval thường/adaptive, ngôn ngữ, model profile được duyệt, giới hạn context/output và trả lời một lần hoặc theo conversation.
- ANS-03: Output gồm answer, citations ánh xạ đến chunk/document/version, conversationId/turnId khi lưu, status, usage, finishReason và requestId. Không bịa citation hoặc coi source URL là bằng chứng nếu chưa có nội dung được truy hồi.
- ANS-04: Khi bằng chứng không đủ phải trả trạng thái và câu trả lời thể hiện thiếu dữ liệu; không tự trả lời từ kiến thức model dưới nhãn grounded. Chế độ general knowledge nếu có phải opt-in và phân biệt rõ.
- ANS-05: Xử lý provider timeout/rate limit, token budget và fallback model đã được tenant duyệt; không fallback sang provider/vùng dữ liệu chưa được phép.
- CONV-01: `createConversation`, `listConversations`, `getConversation`, `appendTurn`, `deleteConversation`; mặc định private theo owner trong tenant. Sharing/export chỉ qua quyền explicit.
- CONV-02: Lưu thứ tự message, vai trò, thời gian, citations, run/tool references, model profile và trạng thái mỗi turn. Client không được tự gửi system/developer role có đặc quyền.
- CONV-03: Có idempotency và optimistic concurrency cho submit/retry; hai request đồng thời không ghi đè, nhân đôi answer hoặc trộn lượt.
- CONV-04: Context window có giới hạn; summary memory có provenance/version, không làm mất chỉ dẫn người dùng hoặc biến nội dung không tin cậy thành system instruction.
- CONV-05: Kiểm tra quyền khi tải lịch sử và khi tái dùng source cũ. Không đưa chunk đã bị thu hồi quyền trở lại prompt qua history/summary; nội dung derived nhạy cảm phải được chặn hoặc biên tập lại theo policy.
- CONV-06: Stop, retry turn lỗi và tiếp tục hội thoại có trạng thái rõ ràng; partial answer không hiển thị như completed. Retention, export và xóa conversation theo policy tenant.

### 4.4 Agentic RAG

- AGT-01: `startAgentRun(goal, context, policy)`, `getAgentRun`, `listAgentRuns`, `cancelAgentRun`, `approveAgentAction`, `rejectAgentAction`; hỗ trợ run bền vững qua worker restart.
- AGT-02: Agent có thể lập các bước thực thi, chọn retrieval/tool được phép, tổng hợp evidence và trả final answer có citation; không công khai chain-of-thought. Chỉ công bố tóm tắt hành động và evidence.
- AGT-03: Giới hạn số bước, tool calls, recursion, thời gian, token và chi phí; phát hiện lặp/không tiến triển. Cạn budget phải dừng và báo trạng thái thực.
- AGT-04: Không cho model tự mở scope, tenant, connection, model provider hoặc network destination. Tool inputs phải schema-validate và authorize bên ngoài model.
- AGT-05: Tool chỉ đọc được tự chạy theo allowlist sau data-egress check. Trước mọi outbound call, App policy kiểm tra phân loại dữ liệu × destination × connection × tool, scope user và consent; redact/block input khi cần. Ghi/xóa dữ liệu, gửi tin, thực thi mã hoặc tác động bên ngoài cần approval explicit cho hành động cụ thể, trừ policy preauthorization được admin thiết lập với giới hạn rõ ràng.
- AGT-06: Approval gắn principal, tenant, run, tool, connection version, payload digest, deadline và dùng một lần. Thay input hoặc tool definition phải xin approval mới; kiểm tra quyền lại ngay trước thực thi.
- AGT-07: Tool có side effect cần idempotency hoặc cơ chế reconciliation; timeout không được coi chắc chắn chưa thực thi. Không retry mù dẫn tới tác động lặp.
- AGT-08: Run states tối thiểu queued/running/waiting_approval/succeeded/failed/cancelling/cancelled/expired; chuyển trạng thái atomic, có recovery và ngăn hai worker thực thi cùng step.
- AGT-09: Cancellation ngăn bước mới, truyền hủy tới downstream khi hỗ trợ; side effect đã xảy ra không được tuyên bố rollback. Báo rõ kết quả chưa xác định và tác động còn lại.
- AGT-10: Approval có quyền riêng, không cho requester tự duyệt trừ policy explicit. Approval wait không ăn execution budget; deadline/expiry riêng và audit approver, policy decision, payload digest, destination và data classification.

## 5. MCP Management — backend và trang admin/system

### 5.1 Quyền và phạm vi

| Actor | Trang quản lý MCP | Tenant configuration | Global policy | Dữ liệu RAG |
| --- | --- | --- | --- | --- |
| Superadmin | Có | Tenant đang chọn rõ ràng | Có | Theo ACL riêng; không mặc định bypass |
| Tenant admin | Có | Chỉ tenant hiện tại có membership admin | Không | Theo ACL riêng |
| User/member khác | Không | Không | Không | Có thể dùng tool được cấp quyền |
| Service account/API key | Không đăng nhập trang | Không mặc định có quyền quản trị | Không | Theo scope và ACL |

- MGT-01: Trang logic `admin/system/mcp` chỉ hiện trong menu với superadmin và tenant admin. Route guard và tất cả backend API cùng áp RBAC; truy cập URL trực tiếp cũng bị từ chối.
- MGT-02: Hiện tenant đang thao tác ở mọi màn hình và xác nhận nhạy cảm. Tenant admin không thể đổi tenantId để vượt quyền. Khi switch tenant, hủy request cũ và xóa state/cache/credential form liên quan.
- MGT-03: Global policy chỉ superadmin thay đổi. Tenant chỉ được siết hoặc chọn trong giới hạn global; hiển thị giá trị inherited/effective và lý do field bị khóa.
- MGT-04: UI có EN/VI/JA, light/dark, keyboard navigation, label và thông báo lỗi dễ tiếp cận; đủ trạng thái loading/empty/error/permission-denied, pagination và filter.

### 5.2 Inbound server management

- MGT-05: Xem endpoint, enabled status, supported versions/capabilities, health và hướng dẫn cấu hình client; bật/tắt theo tenant, chọn tool/resource/prompt được công bố.
- MGT-06: Quản lý auth modes được cho phép, IdP/issuer trust, tenant mapping, scopes, API key lifecycle và service account. Tenant không tự khai báo issuer tùy ý vượt trust policy global.
- MGT-07: Quản lý knowledge base allowlist, read/write permissions, model/retrieval profiles, conversation retention, agent budgets, approval policy, quota và rate limit.
- MGT-08: Tạo cấu hình kết nối mẫu đã redacted cho client bên ngoài; hướng dẫn SSO và API key riêng, compatibility, revoke và troubleshooting. Không nhúng key thật vào tài liệu chia sẻ.

### 5.3 Outbound connections

- MGT-09: `createConnection`, `listConnections`, `getConnection`, `updateConnection`, `disableConnection`, `deleteConnection`; fields gồm tenant, tên, endpoint, transport, auth mode, credential reference, owner, tags, timeout và policy version.
- MGT-10: Hỗ trợ OAuth delegated SSO, API key/header secret theo server, và no-auth chỉ với endpoint được global policy cho phép. Có thể có tenant service credential hoặc user-delegated credential; không tự thay thế hai loại cho nhau.
- MGT-10a: Shared tenant service credential chỉ được dùng nếu App policy chứng minh được destination/tool không đọc hoặc ghi ngoài effective permission của user gọi. Không chứng minh được thì bắt buộc user-delegated credential hoặc từ chối call; không fallback sang shared credential.
- MGT-11: `testConnection` kiểm tra network/auth/`server/discover`/capability discovery bằng cùng egress policy như runtime. Không gọi tool có side effect để health check, không trả secret hoặc raw sensitive response.
- MGT-12: `discoverCapabilities`, `approveCapabilities`, `setToolPolicy`; xem input/output schema, tool annotations, tên server và version. Tool mới hoặc schema/description thay đổi cần review trước khi agent sử dụng.
- MGT-13: Enable/disable connection hoặc từng tool, giới hạn role/knowledge scope/use case; kill switch ngăn lời gọi mới và dừng run ở checkpoint an toàn. Không tự cho mọi tenant dùng global connection.
- MGT-14: Update có validation, optimistic locking, diff đã redacted, version history và rollback cấu hình; rollback không phục hồi key đã revoked hay quyền đã hết hiệu lực.
- MGT-15: Delete có xác nhận và kiểm tra references; làm rõ run đang dùng, retention audit và credential cleanup. Disable trước khi xóa nếu còn hoạt động.

### 5.4 Vận hành và audit

- MGT-16: Dashboard theo tenant/connection/tool: availability, latency p50/p95/p99, call/error/timeout rate, token/cost, quota, active runs, pending approvals, last success và auth expiry.
- MGT-17: Audit actor, tenant, action, target, timestamp UTC, result, request/run ID và thay đổi đã redacted cho auth, credential, policy, discovery approval, tool call và admin operations.
- MGT-18: Lọc/export audit theo quyền với retention và size limit. Alert khi credential sắp hết hạn, lỗi auth tăng, quota gần hết, tool thay đổi hoặc connection degraded.
- MGT-19: Chức năng quản trị cần các API tương đương UI, validate phía server, bảo vệ CSRF khi dùng cookie, rate limit và audit. Không dựa vào trường disabled/hidden phía FE.
- MGT-20: Tenant admin không được tạo/cấp API key, service account, connection policy hoặc allowlist có effective privilege/data reach vượt permission hiện tại của họ. Auth mode, credential, egress, global policy và privilege escalation cần MFA/step-up; thay đổi high-risk cần two-person approval khi global policy bật.
- MGT-21: Có lifecycle tenant onboarding/suspend/offboarding, export/purge và chứng thực purge trên App API, MCP service, cache/index/object storage/backup policy. Có version/promotion dev-staging-production cho MCP config, policy/model/prompt; mỗi run lưu version đã dùng.

## 6. MCP Client — chức năng

- CLI-01: Connection manager TypeScript phía backend hỗ trợ HTTPS Streamable HTTP MCP `2026-07-28`, `server/discover`, per-request metadata/capability/version và cleanup; không để browser giữ credential downstream dùng chung.
- CLI-02: `connect`, `disconnect`, `listTools`, `callTool`, `listResources`, `readResource`, `listPrompts`, `getPrompt` theo capabilities thực. Không tự đọc mọi resource hoặc inject mọi prompt vào model context.
- CLI-03: OAuth discovery/login/callback/refresh/revoke theo giao thức hỗ trợ, refresh single-flight, bảo vệ state/PKCE và user/tenant binding. Cần đăng nhập lại thì trả trạng thái actionable, không fallback sang credential quyền cao hơn.
- CLI-04: API key lấy qua secret reference, chỉ đưa vào request đúng destination; redact headers. Credential cache và connection pool phân vùng tenant/principal/auth mode.
- CLI-05: Namespace tool theo connectionId và tool name để tránh collision. Lưu fingerprint schema/description/capabilities; thay đổi chưa duyệt phải chặn sử dụng và thông báo admin.
- CLI-06: Validate input trước gọi, validate output trước sử dụng; giới hạn nesting, bytes, content types và tool/resource result. Xử lý server không tuân schema bằng lỗi có cấu trúc.
- CLI-07: Timeout theo connect/call/overall run, cancellation, backpressure và giới hạn concurrency. Retry exponential backoff+jitter chỉ khi an toàn; tôn trọng Retry-After và dùng circuit breaker.
- CLI-08: Stream đứt hoặc request lỗi không tự replay thao tác có side effect; request mới dùng ID mới. Auth/transport/tool lỗi phân biệt; tránh login/refresh/reconnect loop vô hạn.
- CLI-09: Kết quả MCP là dữ liệu không tin cậy: không biến tool description, prompt hoặc resource thành system instruction; nội dung yêu cầu lấy secret/chuyển dữ liệu phải bị policy bên ngoài model chặn.
- CLI-10: Roots, Sampling và Logging core đã deprecated: không thêm mới. MRTR/input-required mặc định tắt; nếu bật cho user input hợp lệ thì requestState gắn caller/run, có budget/consent, và không dùng để lấy password/API key hoặc tiết lộ file-system roots.
- CLI-11: Backend trả event/status đã sanitize cho UI, có correlation đến run và conversation; không trả raw secret, nội dung vượt ACL hoặc stack trace nội bộ.
- CLI-12: Document và kiểm thử client ngoài kết nối inbound qua cả SSO/API key. Không tuyên bố tương thích chỉ từ `server/discover`; phải gọi retrieval, answer, scope step-up và xử lý auth expiry thực.
- CLI-13: Client dùng OAuth Client ID Metadata Documents hoặc pre-registration; Dynamic Client Registration chỉ fallback compatibility. Persist credential theo issuer, kiểm tra authorization-response `iss`, và luôn gửi OAuth `resource` canonical URI; không reuse token/credential giữa authorization server hoặc destination.

## 7. Yêu cầu bảo mật chung

- SEC-01: Tenant isolation xuyên App API, MCP service, database, index, object storage, cache, queue, conversation, audit, metrics và secret. Tenant context lấy độc lập từ user identity đã xác minh tại App API; filter do caller/MCP service gửi chỉ có thể thu hẹp.
- SEC-02: Chặn IDOR/BOLA trên mọi ID: chunk/document/conversation/run/connection/key/approval. Lỗi không tiết lộ tồn tại tài nguyên tenant khác.
- SEC-03: TLS cho external traffic; encrypt at rest và secret manager cho credential outbound cần giải mã. Key mã hóa tách khỏi dữ liệu, có rotation và audit truy cập.
- SEC-04: Chống SSRF cho endpoint, discovery, redirect, JWKS, OAuth metadata, source fetch và resource link: allowlist scheme/host/port, kiểm tra DNS/IP khi kết nối và mỗi redirect, chặn loopback/link-local/metadata/private network mặc định. Intranet chỉ qua policy cụ thể do superadmin duyệt; chống DNS rebinding và credential forwarding khác origin.
- SEC-05: Validate Origin theo transport; CORS allowlist tối thiểu, không wildcard kèm credentials. Host/proxy headers chỉ tin reverse proxy được cấu hình; chống DNS rebinding.
- SEC-06: Chống prompt injection/tool poisoning và data exfiltration bằng ACL, tool allowlist, outbound policy, output handling và approval; không coi prompt bảo vệ là ranh giới bảo mật đủ.
- SEC-07: Chống XSS/HTML injection trong markdown, citations, tool descriptions và logs UI; URL scheme allowlist. Không tự mở link, tải remote image hoặc thực thi nội dung trả về.
- SEC-08: Giới hạn request body, query length, topK, file size, JSON depth, regex/filter complexity, stream duration và outstanding requests; rate limit theo principal/key/tenant/IP và bảo vệ noisy neighbor.
- SEC-09: Không log access/refresh token, API key, cookie, authorization code, raw prompt/chunk mặc định. Debug capture phải opt-in, có quyền, TTL và redaction; telemetry không dùng nội dung khách hàng để huấn luyện.
- SEC-10: Data residency, provider data-use policy, PII handling, retention và quyền xóa/export cấu hình theo tenant trong giới hạn global. Không gửi dữ liệu sang third party ngoài allowlist.
- SEC-11: Dependency pinning/lockfile, SBOM, secret scan và vulnerability scan; không phát hành với lỗ hổng critical/high có khả năng khai thác chưa được xử lý hoặc chấp nhận rủi ro có chủ sở hữu và deadline.
- SEC-12: Audit chống sửa/xóa trái phép, phân quyền đọc riêng và phát hiện mất audit. Các thay đổi đặc quyền thất bại nếu không thể ghi audit bền vững; truy cập RAG có cơ chế audit buffer được giới hạn và cảnh báo.
- SEC-13: Threat model bao phủ auth bypass, confused deputy, token theft, cross-tenant leak, malicious server, malicious document, SSRF, replay và approval race; có kiểm thử đối kháng tương ứng.
- SEC-14: System API key của MCP service nằm trong secret manager, chỉ mount/inject vào container MCP runtime, có distinct key theo environment/deployment, allowlisted App API route, rotation/revoke và audit. Không gửi key tới IDE/client, browser, prompt, log hoặc outbound MCP server.
- SEC-15: Docker workload hardening: immutable minimal image, non-root user, read-only root filesystem, dropped Linux capabilities, resource limit, network policy chỉ tới IdP/App API/đích được duyệt, image signing/SBOM/vulnerability scan và runtime secrets không nằm trong image.

## 8. Yêu cầu phi chức năng và vận hành

- NFR-01: Tách capability khỏi provider cụ thể; có hợp đồng thay thế identity, retrieval/index, LLM, persistence, secret và telemetry. Không bắt buộc một database/vector store/vendor trong spec này.
- NFR-02: Có readiness/liveness, graceful shutdown/drain, bounded queues và backpressure; restart không mất run đã nhận bền vững. Health công khai không lộ topology/credential.
- NFR-03: Scale ngang với state/job được xử lý nhất quán; quota/rate limit và idempotency có hiệu lực xuyên replica. MCP protocol không stateful; không dựa vào memory của một process để bảo đảm isolation, handle ownership hoặc job ownership.
- NFR-04: Availability mục tiêu 99.9%/tháng cho API quản lý và tiếp nhận MCP; đo riêng tỷ lệ hoàn thành end-to-end có downstream để không che lỗi provider.
- NFR-05: Profile benchmark tối thiểu 10 tenant, 100k chunk/tenant, 50 request đồng thời. Mục tiêu p95 management/discovery ≤ 500 ms, retrieval thường ≤ 2 s, adaptive ≤ 10 s; ghi rõ hardware/index/provider/network/cache và số liệu cold/warm.
- NFR-06: Answer mục tiêu p95 time-to-first-token ≤ 5 s ở kênh hỗ trợ streaming, hoàn thành ≤ 30 s với output tối đa 1,000 token trên profile công bố. MCP không hỗ trợ token stream vẫn phải có progress/status và deadline; benchmark ghi rõ dependency latency.
- NFR-07: Default budget: query ≤ 8,000 ký tự, topK ≤ 50, adaptive ≤ 4 lượt, agent ≤ 20 bước/50 tool calls/120 giây, tool call ≤ 30 giây. Tenant được giảm; chỉ global policy được nâng ceiling. Có token và cost ceiling bắt buộc theo model profile.
- NFR-08: Usage/cost attribution theo tenant/principal/run/model/tool; tách số đo thực và ước tính. Reserve budget trước thực thi, reconcile sau khi kết thúc; chống concurrent calls vượt quota và giới hạn overshoot đã công bố.
- NFR-09: OpenTelemetry hoặc tương đương với trace xuyên inbound → retrieval → generation → outbound, structured logs, metrics cardinality có giới hạn và alert có owner/runbook.
- NFR-10: Timeout, retry/circuit breaker, provider outage, stale index, cache outage và queue backlog có hành vi degraded rõ ràng; fail closed với auth/ACL/tenant context không xác minh được.
- NFR-11: Backup/restore được diễn tập; mục tiêu RPO ≤ 15 phút, RTO ≤ 4 giờ cho config/conversation/run/audit. Index có thể rebuild nhưng phải công bố thời gian và ảnh hưởng phục vụ; backup bảo vệ như dữ liệu gốc.
- NFR-12: Config/schema migration có version, upgrade/rollback strategy và compatibility window; deployment không làm lệch policy giữa replica. Có release rollback và runbook revoke credential/disable connection/incident response.
- NFR-13: RAG evaluation có tập câu hỏi EN/VI/JA, unanswerable, multi-turn, ACL và prompt injection; đo recall@K, nDCG hoặc metric ranking tương đương, citation validity, groundedness, latency và cost. Chốt threshold/baseline có version trước implement và dùng regression gate khi đổi model/index/prompt; không chỉ kiểm tra câu trả lời “có vẻ đúng”.
- NFR-14: Hướng dẫn cấu hình, vận hành, nâng cấp, tích hợp client và mã lỗi; cấu hình môi trường được validate khi khởi động, không chạy với secret/default insecure.

## 9. Danh mục function để coding agent đối chiếu

| Nhóm | Function logic tối thiểu | Bất biến |
| --- | --- | --- |
| Identity | authenticate, resolveTenant, authorizeTool, authorizeResource | Không tin tenant/role từ input |
| App API gateway | authenticateMcpService, authenticateUser, authorizeEffectivePrincipal | Cần cả service key và user token cho tenant-scoped call |
| Credential | createApiKey, rotateApiKey, revokeApiKey, listApiKeys | Không đọc lại key plaintext |
| Retrieval | retrieveChunks, adaptiveRetrieveChunks | Chỉ chunks + metadata, không answer |
| Answer | answerQuestion | Grounding/citation, trạng thái thiếu bằng chứng |
| Conversation | create/list/get/append/deleteConversation | Owner/ACL, concurrency, retention |
| Agent | start/get/list/cancelAgentRun, approve/rejectAgentAction | Budget, durable state, approval binding |
| Knowledge | listKnowledgeBases, list/getDocument, ingest/update/deleteDocument, reindex, getIngestionJob | ACL và write permission explicit |
| Inbound admin | get/updateServerConfig, setExposurePolicy, setAuthPolicy, setQuota | Tenant boundary, config version |
| Outbound admin | create/list/get/update/disable/deleteConnection, testConnection | SSRF và secret isolation |
| Discovery admin | discoverCapabilities, approveCapabilities, setToolPolicy | Không tự tin tool/schema mới |
| MCP client | connect/disconnect, list/callTool, list/readResource, list/getPrompt | Validate, policy, timeout |
| Operations | getHealth, getUsage, list/exportAudit, getAlerts | Redaction, access control |

## 10. Điều kiện chứng minh production trước phát hành

- ACC-01: Có traceability từng requirement ID → implementation evidence → test/verification → kết quả; không dùng checklist đánh dấu suông.
- ACC-02: Chạy ít nhất hai MCP client độc lập: SSO login/callback/refresh/expiry/revoke, API key call/rotation/revoke, discovery và lỗi protocol; ghi rõ phiên bản/client limitation.
- ACC-02a: Kiểm thử VS Code phiên bản được hỗ trợ kết nối remote Streamable HTTP bằng OAuth public-client/PKCE: protected-resource discovery, Client ID Metadata/pre-registration, callback, token refresh/expiry, scope step-up, revoke và tools/call. Lưu cấu hình mẫu đã redacted và compatibility matrix; VS Code chỉ là một client trong matrix.
- ACC-03: Kiểm thử tất cả role trên menu, direct route và backend; tenant A không thể list/read/write/call/replay/cache-hit dữ liệu tenant B kể cả sửa ID, session hoặc approval.
- ACC-04: Retrieval/adaptive không tạo answer/conversation turn, không trả chunk ngoài ACL, giới hạn vòng lặp đúng, và phân biệt no-result với dependency failure.
- ACC-05: Full answer chạy đủ single-turn/multi-turn, valid citations, no-evidence, retry/concurrent submit, provider failure, partial/cancel và source permission revocation.
- ACC-06: Agent bị chặn khi vượt quyền/budget, tool definition đổi, approval hết hạn/thay payload, malicious tool output hoặc restart giữa side effect; chứng minh không double execute.
- ACC-07: Quản trị inbound/outbound đủ vòng đời cấu hình/key/connection; global ceiling không bị tenant bypass, tenant switch không rò state, kill switch có hiệu lực đúng giới hạn.
- ACC-08: Security tests gồm SSRF redirect/DNS rebinding/OAuth metadata, XSS, CSRF, token audience/issuer mismatch, secret log leakage và injection từ document/tool/resource.
- ACC-08a: Kiểm thử App API từ MCP container: thiếu/sai/revoked system key; thiếu/sai/expired/revoked user token; user tenant A cố chọn tenant B; MCP service tự khai `role`/`tenantId`; shared credential vượt quyền user; IdP deprovision; stream/run/approval khi quyền bị thu hồi. Mọi trường hợp phải fail closed và audit.
- ACC-09: Có load/soak test, dependency outage, queue saturation, multi-replica consistency, backup restore và graceful drain; công bố số đo so với mục tiêu, giới hạn và lỗi còn tồn tại.
- ACC-10: UI EN/VI/JA, dark/light và accessibility được kiểm tra; operator có dashboard, alert, runbook và hướng dẫn client thực dùng được.
- ACC-11: Build/typecheck, contract/integration/security tests phải đạt; unit test không thay thế xác minh SSO thật, MCP client thật hoặc storage/index thật. Nếu chưa có môi trường phải đánh dấu chưa verify, không tuyên bố production-ready.

## 11. Kiến trúc deploy và trust boundary

```text
IDE / MCP client -- OAuth user access token --> MCP server container
MCP server container -- system API key + delegated user token --> App API
App API -- own token validation + tenant/RBAC/ACL --> RAG data and jobs
```

- DEP-01: MCP service không là authorization authority cho dữ liệu App. Nó validate protocol/auth tối thiểu, sau đó App API ra quyết định cuối; App API không cho MCP service thay user authorization result.
- DEP-02: Internal App API dùng mTLS hoặc private network phù hợp môi trường, ngoài system API key; network policy từ MCP container chỉ mở IdP/App API và destination đã approved. Public MCP endpoint không được truy cập internal App API trực tiếp.
- DEP-03: Nếu user token không có audience hợp lệ cho App API, dùng OAuth token exchange/on-behalf-of do IdP hỗ trợ hoặc cấp token riêng cho App resource qua SSO; không dùng system API key thay token, không tự đổi claim ở MCP service.
- DEP-04: Mỗi App API operation truyền correlation ID, service identity và user subject; audit ghi cả ba. App API tự load tenant/permission hiện hành từ trusted source, không dùng state/cache từ MCP service làm authority.

## 12. Nguồn chuẩn để coding agent kiểm chứng

Các nguồn dưới đây dùng cho phần giao thức; yêu cầu RAG, quản trị và SLO là yêu cầu sản phẩm của spec. Baseline bắt buộc là MCP `2026-07-28`; agent phải kiểm tra SDK/schema thực dùng và ghi rõ compatibility trước lập plan.

- [MCP 2026-07-28 Introduction](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro): baseline MCP hiện hành.
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog): stateless requests, `server/discover`, MRTR và deprecated features.
- [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): OAuth protected resource, discovery, resource-bound access token và client authorization.
- [MCP Transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports): Streamable HTTP và transport lifecycle.
- [VS Code MCP Guide](https://code.visualstudio.com/api/extension-guides/ai/mcp): OAuth và remote MCP interoperability.

Spec không xác nhận bất kỳ requirement nào đã được hiện thực trong codebase. Coding agent tiếp theo phải tự khảo sát, đưa ra gap analysis và plan trước khi triển khai.
