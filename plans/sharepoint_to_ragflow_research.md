# Research & Implementation Report: Automated SharePoint → RAGFlow Document Ingestion

**Audience:** A coding agent (and the engineer reviewing it) tasked with implementing an end-to-end pipeline that automatically pulls documents from an enterprise Microsoft SharePoint Online into a RAGFlow knowledge base, on a schedule, with no interactive user login.

**Status of source research:** Verified against Microsoft Graph documentation, the `Office365-REST-Python-Client` and `msgraph-sdk` packages, and the current RAGFlow `main` branch (including connector source and open feature issue) as of May 2026.

---

## 1. Objective

Build a backend service that:

1. Authenticates to Microsoft 365 **without any interactive user sign-in** (unattended / daemon).
2. Enumerates one or more specified SharePoint sites and their document libraries.
3. Downloads document files (PDF, DOCX, XLSX, PPTX, TXT, etc.).
4. Pushes those files into a RAGFlow dataset (knowledge base) and triggers parsing.
5. Runs on a **schedule** and performs **incremental sync** (only new / modified / deleted files), with throttling resilience.
6. (Optional, later phase) Mirrors SharePoint access control (ACL) into RAGFlow.

---

## 2. Key Findings (read before designing)

### 2.1 Feasibility: YES, with the correct auth model

Unattended backend access to SharePoint is a first-class, officially supported scenario in Microsoft 365. It is implemented with **app-only authentication** using the **OAuth 2.0 client credentials grant** against Microsoft Entra ID (formerly Azure AD). The application authenticates as itself (a service principal), not as a human user. Tokens are acquired and refreshed by the app automatically — no login prompt, no MFA prompt, no human in the loop.

### 2.2 CRITICAL: RAGFlow's built-in SharePoint connector is NOT functional yet

The file `common/data_source/sharepoint_connector.py` on RAGFlow `main` is a **scaffold/stub**, not a working connector:

- `load_credentials()` and `validate_connector_settings()` ARE implemented — authentication (MSAL client credentials) works.
- `poll_source()`, `load_from_checkpoint()`, `load_from_checkpoint_with_perm_sync()`, and `retrieve_all_slim_docs_perm_sync()` are all stubs that `return []` ("Simplified implementation"). **No documents are ever fetched.**
- The corresponding server hook `SharePoint._generate()` in `rag/svr/sync_data_source.py` is currently `pass`.
- `SharePointConnector` is not exported from `common/data_source/__init__.py`, and the frontend data-source enum/form for SharePoint is commented out.
- SharePoint is not in RAGFlow's list of active connectors and is tracked as an **open feature request**.

**Consequence:** You cannot simply configure credentials and use the built-in connector today. There are two implementation paths.

### 2.3 Two implementation paths

| | Path A — Complete the built-in connector | Path B — External pipeline → RAGFlow API |
|---|---|---|
| What you build | Implement the stub methods (`load_from_checkpoint`, slim-doc retrieval, `_generate`, exports, frontend enum) inside the RAGFlow codebase | A standalone Python service that uses Microsoft Graph to fetch files, then pushes them into RAGFlow via the `ragflow_sdk` / HTTP API |
| Coupling | Tightly coupled to RAGFlow internals (checkpoints, perm-sync interfaces, build process) | Loosely coupled; RAGFlow treated as a black box with a public API |
| Time to working PoC | Slower (must learn RAGFlow connector framework, rebuild image) | Faster; works on a stock RAGFlow deployment |
| Upstream value | Could become a PR | None directly |
| Recommended now | Only if you intend to contribute upstream | **Yes — default choice** |

**This report targets Path B** as the primary deliverable, because it works against a stock RAGFlow deployment today and is independent of the connector's maturity. Notes on Path A are included in Appendix B.

---

## 3. Authentication Design (the core of "no user login")

### 3.1 Use application permissions (app-only), not delegated/user tokens

- **App-only (application permissions):** the app acts as itself. Correct for an unattended backend. Requires a one-time **admin consent**.
- **Delegated / user token / "personal token":** acts on behalf of a signed-in user. **Do NOT use for this service.** It requires an interactive sign-in to bootstrap, short token lifetimes, refresh tokens that can be revoked, and it breaks when the user leaves, changes password, or is hit by MFA / Conditional Access. SharePoint/Entra has no GitHub-style "personal access token"; the nearest equivalent is a delegated OAuth token, which is unsuitable for 24/7 automation.

### 3.2 Do NOT use deprecated flows

- **Username/password (ROPC):** dying. Microsoft now enforces MFA broadly (admin portals since Oct 2024; CLI/PowerShell/REST/IaC tooling from Sep 2025), so service accounts using username+password stop working even in scripts.
- **Azure ACS app-only:** being retired; migration deadline April 2, 2026. Do not build on it.

### 3.3 Credential type: certificate, not client secret

Both work with client credentials, but for a long-running service prefer a **certificate**:

- Client secrets expire (max ~24 months) and have caused intermittent "Unsupported app only token" failures for some tenants.
- Certificates are more robust for daemons and are Microsoft's recommendation for production app-only.
- Support both in code, but default config and docs should use certificate.

### 3.4 Permission scoping: prefer `Sites.Selected`

Two options for the application permission:

1. **`Sites.Selected`** (recommended, least privilege): app gets access only to explicitly granted sites. A **Site Collection Administrator** grants per-site `read` (or `write`) via Graph (`POST /sites/{site-id}/permissions`) or PnP PowerShell. Tenant-wide blast radius is minimal.
2. **`Sites.Read.All` + `Files.Read.All`** (broad): app can read all sites. Simpler to set up but security review will likely push back.

For read-only ingestion, `read` role is sufficient. Add `Files.Read.All` only if needed for cross-site drive access patterns.

### 3.5 One-time Azure / Entra ID setup (manual, by an admin)

The coding agent should document these as prerequisites (they are not automatable by the app itself):

1. Entra admin center → App registrations → New registration. Record **Application (client) ID** and **Directory (tenant) ID**.
2. Certificates & secrets → upload the public cert (`.cer`/`.crt`). Record the **thumbprint**. Keep the private key (`.pem`) in the secret store.
3. API permissions → Microsoft Graph → **Application permissions** → add `Sites.Selected` (or `Sites.Read.All` + `Files.Read.All`).
4. **Grant admin consent** (Global Admin or Privileged Role Admin).
5. If using `Sites.Selected`: for each target site, a site-collection admin grants the app `read` on that site (Graph `POST /sites/{site-id}/permissions` or PnP PowerShell `Grant-PnPAzureADAppSitePermission`).

---

## 4. Recommended Libraries

| Purpose | Library | Origin | Notes |
|---|---|---|---|
| Token acquisition | `msal` | Official Microsoft | `ConfidentialClientApplication.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])` |
| Identity helper (alt) | `azure-identity` | Official Microsoft | `ClientCertificateCredential` / `ClientSecretCredential`; pairs with the Graph SDK |
| Graph calls (recommended) | `msgraph-sdk` | Official Microsoft | GA, async-friendly, typed models |
| Graph/SharePoint calls (alt) | `Office365-REST-Python-Client` (`office365`) | Community (vgrem) | Popular, SharePoint-friendly; the package RAGFlow's stub imports |
| RAGFlow ingestion | `ragflow-sdk` | RAGFlow | `RAGFlow(api_key, base_url)`, `create_dataset`, `upload_documents`, `list_documents` |
| HTTP / retries | `httpx` or `requests` + custom backoff | — | For raw Graph REST + delta if not using the SDK |

A minimal, dependency-light stack is acceptable: `msal` + `requests` (or `httpx`) for Graph, plus `ragflow-sdk`. The official `msgraph-sdk` is cleaner but heavier; either is fine. Pick one and be consistent.

---

## 5. Target Architecture (Path B)

```
+-------------------+      +-----------------------+      +------------------+
|  Scheduler        | ---> |  Ingestion Service    | ---> |  RAGFlow         |
|  (cron / Celery / |      |  (this project)       |      |  (stock deploy)  |
|   Airflow)        |      |                       |      |                  |
+-------------------+      |  - AuthTokenManager   |      |  ragflow_sdk /   |
                           |  - GraphClient        |      |  HTTP API        |
        state <----------- |  - SharePointCrawler  |      |  dataset.upload  |
   (delta tokens,          |  - DeltaSync          |      +------------------+
    dedup index)           |  - RagflowUploader    |
                           |  - ThrottleHandler    |
                           +-----------------------+
                                     |
                                     v
                          Microsoft Graph API
                       (SharePoint sites & drives)
```

### Module responsibilities

- **AuthTokenManager** — acquires and caches the app-only token (certificate-based), refreshes before expiry.
- **GraphClient** — thin wrapper over Graph REST endpoints; injects auth header; centralizes throttling/backoff.
- **SharePointCrawler** — resolves site → drive(s), enumerates document libraries and items.
- **DeltaSync** — performs incremental sync using Graph `delta` queries; persists `deltaLink` per drive; classifies items as added / modified / deleted.
- **RagflowUploader** — maps changes to RAGFlow operations: locate-or-create dataset, upload new/changed files, delete removed files, trigger parsing.
- **State store** — persists delta links and a dedup index (SharePoint item id → {ragflow doc id, eTag, lastModifiedDateTime}). Start with a local SQLite/JSON file; abstract behind an interface so it can move to Redis/DB later.
- **ThrottleHandler** — honors HTTP 429 `Retry-After`, exponential backoff with jitter, max retries.
- **Scheduler** — triggers a sync run at a configured interval.

---

## 6. Microsoft Graph Endpoints (reference)

Use Graph (`https://graph.microsoft.com/v1.0`) for files; it is the supported, app-only-friendly surface.

- Resolve a site by path: `GET /sites/{hostname}:/sites/{site-path}`
- List a site's drives (document libraries): `GET /sites/{site-id}/drives`
- The default document library drive: `GET /sites/{site-id}/drive`
- Enumerate / incremental: `GET /drives/{drive-id}/root/delta` (follow `@odata.nextLink`; persist `@odata.deltaLink`)
- Download file content: `GET /drives/{drive-id}/items/{item-id}/content`
- Item metadata (eTag, lastModifiedDateTime, file vs folder, deleted facet): present on each delta item.

**Throttling:** Graph returns HTTP 429 with a `Retry-After` header under load. The GraphClient must respect it. Prefer `delta` over full re-crawls to minimize calls on large libraries.

---

## 7. RAGFlow Ingestion API (reference)

Stock RAGFlow exposes both an HTTP API and a Python SDK. Use the Python SDK (`ragflow-sdk`):

```python
from ragflow_sdk import RAGFlow

rag = RAGFlow(api_key="<RAGFLOW_API_KEY>", base_url="http://<host>:9380")

# locate or create the dataset (knowledge base)
existing = rag.list_datasets(name="sharepoint_kb")
ds = existing[0] if existing else rag.create_dataset(name="sharepoint_kb")

# upload one or more documents (binary blob + display name)
ds.upload_documents([
    {"display_name": "policy.pdf", "blob": file_bytes},
])

# list to support dedup / cleanup
docs = ds.list_documents()
```

Notes:
- `upload_documents` takes a list of `{"display_name", "blob"}` dicts; `blob` is raw file bytes.
- After upload, trigger/confirm parsing per the current SDK (parsing kicks off document chunking + embedding). The agent should verify the exact parse-trigger method against the installed `ragflow-sdk` version, as method names can shift between releases.
- Use `list_documents()` (and stored mapping) to detect existing docs and to delete documents removed from SharePoint.

---

## 8. Incremental Sync & Deduplication Strategy

1. **First run (per drive):** call `/drives/{id}/root/delta`, page through all items, upload files, store `(item_id → ragflow_doc_id, eTag, lastModified)`, then persist the returned `@odata.deltaLink`.
2. **Subsequent runs:** call the stored `deltaLink`. Graph returns only changes:
   - New item with `file` facet → upload, record mapping.
   - Changed item (different `eTag`/`lastModified`) → re-upload (delete old RAGFlow doc + upload new, or update), update mapping.
   - Item with `deleted` facet → delete corresponding RAGFlow doc, remove mapping.
   - Folders / non-file items → skip.
3. **Dedup key:** SharePoint `item.id` is stable and unique within a drive — use it as the primary key, with `eTag` for change detection. Do not rely on file name alone (names collide and change).
4. **Idempotency:** a re-run with no changes must produce no uploads. The `deltaLink` + mapping table guarantee this.

---

## 9. Implementation Plan (phased, with concrete tasks)

### Phase 0 — Prerequisites (manual/admin, documented not coded)
- [ ] Entra app registration created; client ID + tenant ID recorded.
- [ ] Certificate uploaded; thumbprint + private key secured.
- [ ] `Sites.Selected` (or broad) application permission added + admin consent granted.
- [ ] Per-site `read` permission granted for each target site (if `Sites.Selected`).
- [ ] RAGFlow reachable; RAGFlow API key generated.

### Phase 1 — Auth + read PoC
- [ ] `AuthTokenManager`: acquire app-only token via certificate; unit-test token acquisition and refresh.
- [ ] `GraphClient`: resolve a site, list its drive, list `delta` items, download one file.
- [ ] Confirm target file types are readable app-only (see §11 on Modern Pages).

### Phase 2 — Incremental sync engine
- [ ] `DeltaSync`: full first pass + delta passes; classify add/modify/delete.
- [ ] `State store`: persist `deltaLink` per drive + dedup mapping (SQLite or JSON first).
- [ ] `ThrottleHandler`: 429 `Retry-After`, exponential backoff + jitter, `@odata.nextLink` paging.

### Phase 3 — RAGFlow upload
- [ ] `RagflowUploader`: locate-or-create dataset; upload new/changed files; delete removed; trigger parse.
- [ ] Wire `DeltaSync` change events to uploader operations; ensure idempotency.

### Phase 4 — Scheduling & operations
- [ ] Scheduler (cron/Celery/Airflow) with configurable interval.
- [ ] Structured logging, run summary (added/updated/deleted/skipped counts), failure alerts.
- [ ] Secret management (Key Vault / env-injected secrets; never hard-code cert/keys/API keys).
- [ ] Config via file/env (see §10).

### Phase 5 — (Optional) ACL / permission sync
- [ ] Read SharePoint item/site permissions; map to RAGFlow access controls if/when RAGFlow supports per-document ACLs in your deployment. Treat as stretch goal.

---

## 10. Configuration Schema

Provide config via environment variables and/or a `config.yaml`. Secrets must come from a secret store, not the file.

```yaml
microsoft:
  tenant_id: "<TENANT_ID>"
  client_id: "<CLIENT_ID>"
  auth_mode: "certificate"          # certificate | secret
  certificate_thumbprint: "<THUMBPRINT>"
  certificate_private_key_path: "<PATH_OR_SECRET_REF>"
  # client_secret: from secret store if auth_mode == secret
  graph_scope: "https://graph.microsoft.com/.default"

sharepoint:
  sites:
    - hostname: "contoso.sharepoint.com"
      site_path: "ProjectX"
      drive: "default"              # default | <drive name/id> | all
      include_subfolders: true
  allowed_file_extensions: [".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md"]
  max_file_size_mb: 100

ragflow:
  base_url: "http://localhost:9380"
  api_key: "<RAGFLOW_API_KEY>"      # from secret store
  dataset_name: "sharepoint_kb"
  chunk_method: "naive"

sync:
  interval_minutes: 60
  state_path: "./state/sync_state.db"
  max_retries: 5
  backoff_base_seconds: 2
```

---

## 11. Limitations, Risks & Edge Cases (must handle / document)

1. **Modern Pages (.aspx) content is problematic app-only.** App-only can list `SitePages` but reading the *rendered content* of modern site pages frequently returns 401. If "pages" in scope means actual site pages (not files in a library), app-only may be insufficient and delegated context could be required. **Confirm early** whether the in-scope content is document-library files (works app-only) or site pages (may not). This report assumes document files.
2. **Admin dependency.** Application permissions need admin consent; `Sites.Selected` needs per-site granting. The app cannot self-provision these.
3. **Throttling (429).** Mandatory backoff + `Retry-After`. Use `delta`, not full crawls, for large libraries.
4. **Credential expiry.** Client secrets expire (~24 months max); prefer certificates. Track expiry and alert.
5. **Large files.** Use streaming download (and chunked/resumable upload/download where the file is very large).
6. **eTag/changed-content semantics.** Some metadata-only changes still bump `eTag`; decide whether to re-embed on metadata-only changes (probably skip if content hash unchanged — optional content hashing).
7. **Conditional Access / tenant policies** may block app sign-in for specific networks; coordinate with the tenant admin.
8. **RAGFlow SDK drift.** Method names/signatures (esp. parse-trigger and delete) vary across RAGFlow versions; pin a `ragflow-sdk` version and verify against it.
9. **Deletions.** Honor `deleted` facet so removed SharePoint files are also removed from RAGFlow (avoid stale answers).
10. **Secrets in logs.** Never log tokens, secrets, private keys, or API keys.

---

## 12. Testing & Acceptance Criteria

**Unit / integration tests**
- Token acquisition succeeds with certificate; auto-refresh on expiry.
- 429 handling: simulated `Retry-After` is respected; backoff bounded by `max_retries`.
- Delta classification: add / modify / delete produce correct operations.
- Dedup: a no-change re-run performs zero uploads (idempotent).

**Acceptance criteria (definition of done)**
- [ ] Service runs unattended on schedule with zero interactive logins.
- [ ] New file in SharePoint appears as a parsed document in the RAGFlow dataset within one sync interval.
- [ ] Modified file is re-ingested (old chunks replaced).
- [ ] Deleted file is removed from the RAGFlow dataset.
- [ ] A run with no SharePoint changes uploads nothing.
- [ ] Throttling does not crash the run; it retries and completes.
- [ ] No secrets are hard-coded or logged.
- [ ] Configurable: target sites, file-type filter, interval, dataset name.

---

## 13. Reference Code Skeleton (starting point for the agent)

> Illustrative only — productionize with the structure in §5, real config, logging, and error handling.

```python
import time
import msal
import requests
from ragflow_sdk import RAGFlow

GRAPH = "https://graph.microsoft.com/v1.0"


class AuthTokenManager:
    def __init__(self, tenant_id, client_id, thumbprint, private_key_pem):
        self._app = msal.ConfidentialClientApplication(
            client_id=client_id,
            client_credential={"thumbprint": thumbprint, "private_key": private_key_pem},
            authority=f"https://login.microsoftonline.com/{tenant_id}",
        )

    def token(self) -> str:
        res = self._app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        if "access_token" not in res:
            raise RuntimeError(f"Token error: {res.get('error_description')}")
        return res["access_token"]


class GraphClient:
    def __init__(self, auth: AuthTokenManager, max_retries=5, backoff_base=2):
        self.auth = auth
        self.max_retries = max_retries
        self.backoff_base = backoff_base

    def _get(self, url, stream=False):
        for attempt in range(self.max_retries):
            r = requests.get(url, headers={"Authorization": f"Bearer {self.auth.token()}"},
                             stream=stream)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", self.backoff_base ** attempt))
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r
        raise RuntimeError(f"Throttled too many times: {url}")

    def resolve_site(self, hostname, site_path):
        return self._get(f"{GRAPH}/sites/{hostname}:/sites/{site_path}").json()

    def default_drive(self, site_id):
        return self._get(f"{GRAPH}/sites/{site_id}/drive").json()

    def delta(self, delta_url):
        """Yield all items, return final deltaLink. Pass root delta URL or stored deltaLink."""
        items, url = [], delta_url
        while url:
            data = self._get(url).json()
            items.extend(data.get("value", []))
            url = data.get("@odata.nextLink")
            if "@odata.deltaLink" in data:
                return items, data["@odata.deltaLink"]
        return items, None

    def download(self, drive_id, item_id) -> bytes:
        return self._get(f"{GRAPH}/drives/{drive_id}/items/{item_id}/content",
                         stream=True).content


class RagflowUploader:
    def __init__(self, api_key, base_url, dataset_name):
        self.rag = RAGFlow(api_key=api_key, base_url=base_url)
        found = self.rag.list_datasets(name=dataset_name)
        self.ds = found[0] if found else self.rag.create_dataset(name=dataset_name)

    def upload(self, display_name, blob):
        self.ds.upload_documents([{"display_name": display_name, "blob": blob}])
        # TODO: trigger/confirm parsing per installed ragflow-sdk version

    def delete_by_mapping(self, ragflow_doc_id):
        # TODO: implement deletion per installed ragflow-sdk version
        ...


def sync_drive(graph: GraphClient, uploader: RagflowUploader, state, drive_id, site_drive_root_delta):
    start_url = state.get_delta_link(drive_id) or site_drive_root_delta
    items, new_delta = graph.delta(start_url)
    for it in items:
        if it.get("deleted"):
            doc_id = state.pop(drive_id, it["id"])
            if doc_id:
                uploader.delete_by_mapping(doc_id)
            continue
        if "file" not in it:
            continue  # skip folders
        prev = state.get(drive_id, it["id"])
        if prev and prev["eTag"] == it.get("eTag"):
            continue  # unchanged
        blob = graph.download(drive_id, it["id"])
        uploader.upload(it["name"], blob)
        state.put(drive_id, it["id"], etag=it.get("eTag"),
                  last_modified=it.get("lastModifiedDateTime"))
    if new_delta:
        state.set_delta_link(drive_id, new_delta)
```

---

## Appendix A — Decision Summary

- **Auth:** app-only, client credentials, **certificate**, `Sites.Selected` (least privilege).
- **Do not use:** delegated/personal tokens, username+password (ROPC), ACS app-only.
- **Libraries:** `msal` (+ optional `msgraph-sdk`) for Graph; `ragflow-sdk` for RAGFlow.
- **Integration approach:** **Path B** — external pipeline → RAGFlow public API (because RAGFlow's built-in SharePoint connector is currently a non-functional stub).
- **Sync:** Graph `delta` + persisted `deltaLink` + `(item_id, eTag)` dedup; handle add/modify/delete; idempotent.
- **Watch out for:** Modern Pages 429/401, throttling, secret/cert expiry, RAGFlow SDK version drift.

## Appendix B — If you instead choose Path A (complete the built-in connector)

Implement, in the RAGFlow codebase, the methods left as stubs: `load_from_checkpoint()` (page document libraries via Graph delta), the slim-doc retrieval for permission sync, `build_dummy_checkpoint()`, `validate_checkpoint_json()`; implement `SharePoint._generate()` in `rag/svr/sync_data_source.py`; export `SharePointConnector` from `common/data_source/__init__.py`; and enable the frontend data-source enum + form fields (tenant_id, client_id, client_secret, site_url). The required permissions are the same (`Sites.Read.All` / `Files.Read.All` or `Sites.Selected`, with admin consent). This path is appropriate only if you intend to maintain a fork or submit an upstream PR; it is slower and more tightly coupled than Path B.

---

*End of report.*
