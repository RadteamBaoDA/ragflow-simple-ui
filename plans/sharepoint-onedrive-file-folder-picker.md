# Spec: SharePoint / OneDrive Picker

## 1. Goal

The ReactJS application must allow users to:

- Sign in to Microsoft Entra ID with an organizational account.
- Open Microsoft File Picker v8.
- Browse accessible SharePoint sites, document libraries, and OneDrive.
- Select multiple files or one folder.

The application returns only the selected item metadata. File downloading, uploading, synchronization, recursive folder browsing, and a custom SharePoint browser are out of scope. SharePoint sites are navigation locations; the final selection is a file or folder.

## 2. Technology

- Frontend: ReactJS, `@azure/msal-browser`, and Microsoft File Picker v8.
- Backend: NodeJS, used only to expose public configuration.
- Authentication: OAuth 2.0 delegated permissions without a client secret.

## 3. Microsoft Entra ID Setup

Create a single-tenant Single-page application (SPA) registration:

- Add the exact ReactJS origin as a redirect URI, such as `http://localhost:3000`.
- Record the `clientId`, `tenantId`, and SharePoint URL, such as `https://contoso.sharepoint.com`.
- Do not create a client secret.

Required delegated read permissions:

- Microsoft Graph: `User.Read`, `Files.Read.All`, `Sites.Read.All`.
- SharePoint: `MyFiles.Read`, `AllSites.Read`.

Grant admin consent when required by tenant policy. The picker must only show resources available to the signed-in user.

## 4. NodeJS Configuration

NodeJS exposes non-secret configuration:

```json
{
  "clientId": "<application-client-id>",
  "tenantId": "<directory-tenant-id>",
  "sharePointUrl": "https://contoso.sharepoint.com"
}
```

## 5. ReactJS Authentication

Initialize one MSAL client:

```ts
const msal = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: "sessionStorage" },
});

await msal.initialize();
```

Token flow:

1. Call `acquireTokenSilent` for the signed-in account.
2. If interaction is required, call `loginPopup` or `acquireTokenPopup`.
3. When the picker sends `authenticate`, acquire a token for `command.resource`.

Tokens remain between the browser and Microsoft and are never sent to NodeJS.

## 6. Microsoft File Picker v8

ReactJS provides two actions:

- **Select files:** `mode: "files"` with multiple selection.
- **Select folder:** `mode: "folders"` with single selection.

Flow:

1. Acquire an access token for the SharePoint URL.
2. Open `{sharePointUrl}/_layouts/15/FilePicker.aspx` in a popup.
3. POST the picker configuration and access token to the popup.
4. Create a `MessageChannel` with a random `channelId`.
5. Accept messages only from the expected popup, origin, and `channelId`.
6. Handle picker commands:
   - `authenticate`: return a token for the requested resource.
   - `pick`: return the selected items and close the popup.
   - `close`: close the popup and return cancellation.
7. Remove all event listeners after success, cancellation, or failure.

Minimal picker configuration:

```ts
const options = {
  sdk: "8.0",
  entry: { oneDrive: {} },
  authentication: {},
  messaging: {
    origin: window.location.origin,
    channelId: crypto.randomUUID(),
  },
  typesAndSources: {
    mode: selectFolder ? "folders" : "files",
    pivots: {
      oneDrive: true,
      sharedLibraries: true,
      myOrganization: true,
      site: true,
    },
    access: { mode: "read" },
  },
  selection: {
    mode: selectFolder ? "single" : "multiple",
  },
};
```

## 7. Selected Item Contract

Each selected item must contain:

```ts
type SelectedItem = {
  id: string;
  name?: string;
  parentReference: { driveId: string };
  "@sharePoint.endpoint": string;
  file?: object;
  folder?: { childCount?: number };
  webUrl?: string;
};
```

The application must not download file content or recursively enumerate folders.

## 8. Security

- Use HTTPS outside local development.
- Request delegated read-only permissions only.
- Never store or log access tokens.
- Validate the popup source, origin, `channelId`, and SharePoint endpoint.
- Reject endpoints outside the tenant's allowed SharePoint hostnames.

## 9. Acceptance Criteria

1. Users can sign in through the configured tenant.
2. The picker shows accessible OneDrive and SharePoint sites/libraries.
3. Users can select multiple files or one folder.
4. ReactJS receives the selected item metadata.
5. Closing the picker is treated as cancellation, not an error.
6. Microsoft tokens are never sent to or stored by NodeJS.
