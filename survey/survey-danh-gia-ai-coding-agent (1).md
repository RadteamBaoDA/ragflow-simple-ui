# Survey đánh giá AI Coding Agent

> **Mục tiêu:** Thu thập thông tin để xây dựng bộ task đánh giá AI Coding Agent trên codebase hiện tại.  
> **Thời gian hoàn thành:** Khoảng 20–30 phút.

**Dự án:** ____________________  
**Người trả lời:** ____________________  
**Vai trò:** ☐ Tech Lead ☐ Developer ☐ QA ☐ DevOps ☐ Khác: __________

## 1. Thông tin codebase

### 1.1. Ngôn ngữ sử dụng

☐ C++ ☐ C# ☐ Khác: ____________________

### 1.2. Công nghệ và phiên bản chính

- C++ compiler/standard: ____________________
- .NET/SDK version: ____________________
- Build system: ☐ CMake ☐ MSBuild ☐ dotnet CLI ☐ Khác: __________
- Hệ điều hành build: ☐ Windows ☐ Linux ☐ Cả hai

### 1.3. Quy mô codebase

☐ Dưới 100.000 LOC  
☐ 100.000–500.000 LOC  
☐ Trên 500.000 LOC  
☐ Monorepo/nhiều module  
☐ Nhiều repository

**Số repository cần agent hiểu đồng thời:** ☐ 1 ☐ 2–10 ☐ 11–50 ☐ Trên 50  
**Tổng số file/LOC của tất cả repository:** __________________________  
**Các repository có dependency chéo không?** ☐ Có ☐ Không ☐ Không rõ  
**Cách liên kết:** ☐ Git submodule ☐ NuGet ☐ DLL/lib nội bộ ☐ API/event ☐ Copy source ☐ Khác: ______  
**Agent có phải truy vết symbol/dependency xuyên repository không?** ☐ Có ☐ Không  
**Có nhiều branch/version cần index song song không?** ☐ Có ☐ Không  
**Repository nào là nguồn chuẩn khi cùng symbol/package có nhiều version?** ____________________

### 1.4. Lệnh chuẩn

- Build: `________________________________`
- Unit test: `____________________________`
- Integration test: `______________________`

## 2. Công việc mong muốn giao cho agent

Chọn các công việc cần đánh giá:

☐ Giải thích function/class  
☐ Tìm dependency và call chain  
☐ Phân tích impact trước khi sửa  
☐ Phân tích root cause  
☐ Sửa bug  
☐ Phát triển feature  
☐ Refactor code  
☐ Viết hoặc cập nhật test  
☐ Nâng cấp dependency/framework  
☐ Review code  
☐ Tối ưu performance  
☐ Sửa lỗi security

**Ba loại công việc ưu tiên nhất:**

1. ____________________
2. ____________________
3. ____________________

## 3. Phạm vi hoạt động của agent

### 3.1. Agent được phép

☐ Đọc toàn bộ source code  
☐ Sửa source code  
☐ Chạy build và test  
☐ Thêm hoặc cập nhật test  
☐ Thêm dependency  
☐ Truy cập internet  
☐ Tạo commit/pull request

### 3.2. Agent không được phép sửa hoặc truy cập

____________________________________________________

### 3.3. Có được gửi source code đến model bên ngoài không?

☐ Có ☐ Không ☐ Chỉ một số module

## 4. Task dùng để đánh giá

### 4.1. Dự án có issue/bug/feature đã hoàn thành và liên kết với commit/PR không?

☐ Có đầy đủ  
☐ Có một phần  
☐ Không

### 4.2. Có thể cung cấp tối thiểu bao nhiêu task?

☐ 5–10 ☐ 10–30 ☐ Trên 30

### 4.3. Mỗi task có thể cung cấp dữ liệu nào?

☐ Mô tả issue  
☐ Commit trước khi sửa  
☐ Patch/PR đã sửa  
☐ Test tái hiện lỗi  
☐ Regression tests  
☐ Thời gian developer đã xử lý  
☐ Danh sách file/symbol liên quan

### 4.4. Tỷ lệ task mong muốn

- Dễ, dưới 15 phút: ______%
- Trung bình, 15–60 phút: ______%
- Khó, 1–4 giờ: ______%
- Rất khó, trên 4 giờ: ______%

## 5. Source-code index, search và phân tích code

> **Lưu ý:** “Index source code” là khái niệm tổng quát. Semantic index chỉ là một loại index; semantic search là cách truy vấn theo ý nghĩa trên index đó.

### 5.1. Hệ thống hiện có loại index/search nào?

| Khái niệm | Phương pháp index điển hình | Dùng để làm gì | Hiện trạng |
|---|---|---|---|
| Text/lexical index | Inverted index, BM25, trigram; hoặc `rg` khi truy vấn trực tiếp | Tìm chính xác chuỗi, identifier, error, config | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| File/path index | Metadata file, path, extension, module | Lọc phạm vi repo/module/ngôn ngữ | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Symbol index | Parser/AST, compiler index, LSP, Tree-sitter | Definition, reference, type, namespace, override | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Dependency index | Import/include/project/package graph | Dependency trực tiếp và xuyên module | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Call graph | Static analysis/AST/IL; có thể bổ sung runtime trace | Caller/callee và call chain | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Type graph | AST/compiler metadata | Inheritance, interface → implementation, generic/template relation | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Runtime wiring index | DI registration, config, reflection scan, runtime trace | Xác định implementation/binding thực tế | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Semantic/vector index | Chunk code theo symbol → embedding → vector database | Tìm code theo ý nghĩa khi không trùng từ khóa | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Code knowledge graph | Symbol + quan hệ typed edges trong graph store | Truy vấn nhiều bước, dependency và impact | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |
| Hybrid retrieval | Text/BM25 + symbol/graph + vector + reranker | Kết hợp độ chính xác và độ bao phủ | ☐ Có ☐ Một phần ☐ Không ☐ Không rõ |

**Công nghệ/thư viện đang dùng cho từng loại:**  
____________________________________________________________________

### 5.1.1. Thư viện/công cụ gợi ý cho C++ và C#

| Loại index | Gợi ý ưu tiên | Giấy phép | Ghi chú lựa chọn |
|---|---|---|---|
| Text/lexical | [Zoekt](https://github.com/sourcegraph/zoekt), [OpenSearch](https://github.com/opensearch-project/OpenSearch), `ripgrep` | Apache-2.0; Apache-2.0; MIT/Unlicense | Zoekt phù hợp tìm code trên nhiều Git repository; OpenSearch phù hợp khi cần BM25, phân tán và metadata filter; `rg` dùng tốt cho truy vấn trực tiếp nhưng không phải persistent index |
| File/path | Zoekt hoặc OpenSearch | Apache-2.0 | Lưu `repo`, `commit`, `branch`, `path`, `language`, `module`, `owner` làm metadata bắt buộc |
| Parser/AST | [Tree-sitter](https://github.com/tree-sitter/tree-sitter), Clang/LLVM, [Roslyn](https://github.com/dotnet/roslyn) | MIT; Apache-2.0 with LLVM exceptions; MIT | Tree-sitter để parse/chunk nhanh đa ngôn ngữ; Clang cho C++ chính xác theo compiler; Roslyn cho syntax + semantic model C# |
| Symbol index | `clangd`/Clangd-indexer cho C++; Roslyn hoặc [scip-dotnet](https://github.com/sourcegraph/scip-dotnet) cho C#; [SCIP](https://github.com/sourcegraph/scip) làm định dạng chung | Apache-2.0 with LLVM exceptions; MIT/Apache-2.0; Apache-2.0 | Ưu tiên compiler-aware index; SCIP hữu ích khi hợp nhất symbol/reference xuyên repository |
| Dependency index | Clang include graph; Roslyn project/reference APIs; SCIP | Như trên | Chuẩn hóa node bằng `repo + commit + package + fully-qualified symbol`; không nối graph chỉ bằng tên symbol |
| Call graph | Clang AST/LLVM; Roslyn `IOperation`/CFG; [Joern](https://github.com/joernio/joern) | Apache-2.0 with LLVM exceptions; MIT; Apache-2.0 | Static call graph cần đánh dấu cạnh `resolved`, `candidate` hoặc `dynamic`; virtual call/reflection không nên coi là chắc chắn |
| Type graph | Clang AST; Roslyn semantic model; SCIP | Như trên | Dùng cho inheritance, override, interface implementation, generic/template specialization |
| Runtime wiring | Roslyn/Clang parser + adapter tự xây cho DI/config; [OpenTelemetry](https://github.com/open-telemetry) cho runtime trace | MIT/Apache-2.0; Apache-2.0 | Không có một thư viện chung tự giải quyết mọi DI, reflection, plugin và macro; cần kết hợp static index với runtime evidence |
| Semantic/vector | Tree-sitter/AST để chunk; [Qdrant](https://github.com/qdrant/qdrant) hoặc OpenSearch để lưu/tìm vector; Sentence Transformers cho embedding/reranker | MIT; Apache-2.0; Apache-2.0 | Phải kiểm tra riêng giấy phép của embedding model; metadata phải có repo/commit/symbol để tránh trả nhầm version |
| Code knowledge graph | Joern Code Property Graph; có thể xuất graph quan hệ riêng | Apache-2.0 | Phù hợp thử nghiệm dependency, data-flow, vulnerability và impact query; cần benchmark coverage C++/C# thực tế của dự án |
| Hybrid retrieval | Zoekt/OpenSearch + SCIP/Clang/Roslyn + Qdrant/OpenSearch + reranker | Chủ yếu Apache-2.0/MIT | Kiến trúc khuyến nghị: lexical lấy identifier chính xác, symbol/graph mở rộng quan hệ, vector bổ sung semantic recall, reranker xếp hạng cuối |

> **Khuyến nghị tối thiểu:** C++ dùng Clang/clangd; C# dùng Roslyn; nhiều repository dùng Zoekt + SCIP; semantic search dùng AST-aware chunking + Qdrant; impact analysis dùng symbol/dependency graph. Tree-sitter không thay thế semantic analysis của compiler.

### 5.2. Cách tạo và cập nhật index

☐ Full index toàn repository  
☐ Incremental index theo file/commit thay đổi  
☐ Index theo branch  
☐ Index riêng cho từng version/release  
☐ Cập nhật tự động qua Git hook/CI  
☐ Xóa/cập nhật được dữ liệu của file hoặc symbol đã đổi  
☐ Có theo dõi trạng thái index: thời điểm, commit SHA, lỗi, độ bao phủ

**Độ trễ cập nhật index sau khi code thay đổi:** ____________________  
**Quy mô index/thời gian full index:** ______________________________

### 5.3. Cách chunk và biểu diễn code cho semantic index

☐ Theo số dòng/token cố định  
☐ Theo function/method/class bằng AST  
☐ Giữ kèm signature, namespace, file path và comments  
☐ Bổ sung caller/callee/dependency vào metadata  
☐ Có xử lý chunk quá dài và overlap  
☐ Có embedding model tối ưu cho code/C++/C#  
☐ Có version của embedding model và cơ chế re-index khi đổi model

**Embedding model/vector store/reranker đang dùng:**  
____________________________________________________________________

### 5.4. Quan hệ code agent phải nhận biết

☐ Function/method calls  
☐ Interface → implementation  
☐ Inheritance/override  
☐ Dependency injection/runtime binding  
☐ Project/package/library reference  
☐ Database/schema  
☐ API/event contract  
☐ Configuration  
☐ Reflection/dynamic loading  
☐ C++ macro/template/conditional compilation

### 5.5. Kiểm thử chất lượng retrieval/index

Với mỗi câu hỏi mẫu, có danh sách file/symbol đúng làm ground truth không? ☐ Có ☐ Không  
Có đo Recall@K/Precision@K/MRR hoặc nDCG không? ☐ Có ☐ Không  
Có đo riêng text, symbol, semantic, graph và hybrid retrieval không? ☐ Có ☐ Không  
Có test index cũ sau rename/move/delete/change branch không? ☐ Có ☐ Không  
Có test C++ macro/template và C# DI/reflection không? ☐ Có ☐ Không  
Có đo thời gian index, latency truy vấn và chi phí lưu trữ/model không? ☐ Có ☐ Không

**Agent có cần chỉ rõ bằng chứng `file + symbol + relation` trong câu trả lời không?**

☐ Có ☐ Không

## 6. Model đang sử dụng

### 6.1. Danh sách model và vai trò

| Thành phần/tác vụ | Provider | Model + version/snapshot | Context window | On-prem/Cloud | Bắt buộc hay fallback |
|---|---|---|---|---|---|
| Agent chính/lập kế hoạch | | | | | |
| Giải thích code/Q&A | | | | | |
| Coding/sửa bug/refactor | | | | | |
| Review/kiểm tra patch | | | | | |
| Embedding code | | | | | |
| Reranker | | | | | |
| Model khác | | | | | |

### 6.2. Cấu hình và chiến lược sử dụng model

☐ Một model cho mọi task  
☐ Chọn model theo loại task  
☐ Model nhỏ xử lý retrieval/classification, model lớn xử lý reasoning/coding  
☐ Có fallback khi model lỗi, rate-limit hoặc quá context  
☐ Có khóa model version/snapshot để benchmark tái lập được  
☐ Có giới hạn temperature/reasoning effort/max output theo task  
☐ Có prompt caching hoặc context caching  
☐ Có theo dõi token, latency và chi phí theo từng task/model

**Quy tắc chọn và chuyển model:**  
____________________________________________________________________

**Ngưỡng context và cách xử lý khi vượt giới hạn:**  
☐ Cắt bớt ☐ Tóm tắt ☐ Retrieval lại ☐ Chia subtask ☐ Chuyển model context lớn

### 6.3. Bảo mật và khả năng tái lập

☐ Source code không rời hạ tầng nội bộ  
☐ Chỉ gửi các chunk đã được lọc  
☐ Có redaction secret/PII trước khi gọi model  
☐ Provider cam kết không dùng dữ liệu để training  
☐ Có lưu `model + version + parameters + prompt version` cho mỗi run  
☐ Có bộ benchmark so sánh các model trên cùng task và cùng context

**Chi phí mục tiêu trên mỗi task:** ____________________  
**Latency mục tiêu:** Q&A ______ giây; coding task ______ phút

## 7. Skill và instruction theo từng task của agent

> **Định nghĩa dùng trong survey:** *Instruction* là quy tắc/prompt chỉ dẫn cách làm; *skill* là gói hướng dẫn theo tác vụ, có thể kèm script, template, tool và tiêu chí kiểm tra. Tool đơn lẻ không tự động được xem là một skill.

### 7.1. Agent hiện có skill/instruction nào?

| Task | Skill/instruction riêng | Tool được phép dùng | Output bắt buộc | Cách kiểm tra hoàn thành | Hiện trạng |
|---|---|---|---|---|---|
| Giải thích function/class | | Search, symbol, dependency | Tóm tắt + `file/symbol` + evidence | Đối chiếu developer/ground truth | ☐ Có ☐ Một phần ☐ Không |
| Tìm dependency/call chain | | Symbol index, graph, runtime trace | Chuỗi quan hệ + loại edge + độ tin cậy | Recall trên dependency chuẩn | ☐ Có ☐ Một phần ☐ Không |
| Phân tích impact | | Reference, graph, test mapping | File/symbol/test/API bị ảnh hưởng | Đối chiếu patch/PR lịch sử | ☐ Có ☐ Một phần ☐ Không |
| Root-cause analysis | | Search, log, test, debugger | Giả thuyết + evidence + cách tái hiện | Root cause đúng/test tái hiện | ☐ Có ☐ Một phần ☐ Không |
| Sửa bug | | Edit, build, test | Patch nhỏ nhất + test chống regression | Build/test + review | ☐ Có ☐ Một phần ☐ Không |
| Phát triển feature | | Plan, edit, build, test | Kế hoạch + code + test + tài liệu | Acceptance criteria | ☐ Có ☐ Một phần ☐ Không |
| Refactor | | Symbol/reference, edit, test | Giữ nguyên behavior/API/ABI | Regression test + diff review | ☐ Có ☐ Một phần ☐ Không |
| Viết/cập nhật test | | Test discovery, runner, coverage | Test đúng framework/convention | Test fail trước, pass sau khi fix | ☐ Có ☐ Một phần ☐ Không |
| Review code | | Diff, static analysis, test | Finding có severity + evidence | Precision/acceptance của reviewer | ☐ Có ☐ Một phần ☐ Không |
| Performance/security | | Profiler/scanner/benchmark | Baseline + finding + patch + so sánh | Benchmark/security test | ☐ Có ☐ Một phần ☐ Không |

### 7.2. Cấu trúc tối thiểu của mỗi skill/instruction

Mỗi skill có khai báo rõ các thành phần sau không?

☐ Tên, mục tiêu và loại task áp dụng  
☐ Điều kiện kích hoạt và trường hợp không được dùng  
☐ Input bắt buộc và câu hỏi cần hỏi lại khi thiếu input  
☐ Quy trình từng bước và điều kiện dừng  
☐ Search/index/tool nào được ưu tiên  
☐ Quyền đọc, sửa, chạy lệnh và vùng cấm  
☐ Output format, citation/evidence bắt buộc  
☐ Build/test/validation bắt buộc trước khi kết luận  
☐ Cách xử lý lỗi, timeout và tool không khả dụng  
☐ Ví dụ đúng/sai hoặc task mẫu  
☐ Owner, version, ngày cập nhật và changelog

### 7.3. Cơ chế chọn và phối hợp skill

☐ Agent tự nhận diện task và chọn skill  
☐ Người dùng chọn skill thủ công  
☐ Một task có thể gọi nhiều skill theo thứ tự  
☐ Có rule xử lý khi nhiều skill xung đột  
☐ Skill có thể gọi sub-agent/chạy song song  
☐ Có giới hạn số vòng lặp, tool call, token, thời gian và chi phí  
☐ Instruction của dự án/repository được ưu tiên hơn instruction chung  
☐ Agent đọc convention/build/test instruction của repository trước khi sửa code

**Thứ tự ưu tiên instruction hiện tại:**  
____________________________________________________________________

### 7.4. Quản lý và đánh giá skill/instruction

☐ Skill được lưu trong source control  
☐ Thay đổi skill phải review/approve  
☐ Skill được version cùng agent/model/index  
☐ Có unit test/eval task riêng cho từng skill  
☐ Có A/B test skill mới với baseline không dùng skill  
☐ Có đo task success, tool error, số vòng lặp, token, latency và chi phí theo skill  
☐ Có log skill nào được kích hoạt và instruction version nào đã dùng  
☐ Có cơ chế rollback khi skill mới làm giảm chất lượng

**Ba skill cần ưu tiên xây dựng hoặc cải thiện:**

1. ____________________
2. ____________________
3. ____________________

## 8. Tiêu chí thành công

Chọn các tiêu chí bắt buộc:

☐ Build thành công  
☐ Test sửa lỗi pass  
☐ Regression test pass  
☐ Không có warning mới  
☐ Không tạo lỗi security  
☐ Không phá API/ABI  
☐ Không sửa ngoài phạm vi  
☐ Code được developer chấp nhận  
☐ Giải thích/dependency/impact chính xác  
☐ Tiết kiệm thời gian so với developer

**Mức kỳ vọng ban đầu:**

- Task hoàn thành đúng: ______%
- Không gây regression: ______%
- Patch có thể merge sau review: ______%
- Thời gian mong muốn tiết kiệm: ______%

## 9. Task mẫu ưu tiên

Vui lòng cung cấp 3–5 task đại diện:

| Task | Loại công việc | Mức độ | Issue/PR/Commit | Người phụ trách |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## 10. Rủi ro hoặc yêu cầu đặc biệt

Ví dụ: dữ liệu nhạy cảm, private package, hardware, Windows-only, database, service nội bộ hoặc thời gian build dài.

____________________________________________________

**Người xác nhận kỹ thuật và kết quả benchmark:**  
Tên/Vai trò: ________________________________________
