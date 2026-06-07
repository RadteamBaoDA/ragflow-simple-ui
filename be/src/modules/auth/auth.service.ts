
import { config } from "@/shared/config/index.js";
import { log } from "@/shared/services/logger.service.js";
import crypto from "crypto";
import { ModelFactory } from "@/shared/models/factory.js";
import { request as httpsRequest } from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

export interface AzureAdUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatar?: string | undefined;
  department?: string | undefined;
  jobTitle?: string | undefined;
  mobilePhone?: string | undefined;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string | undefined;
  id_token?: string | undefined;
}

export interface AzureAdProfile {
  sub: string;
  name?: string | undefined;
  email?: string | undefined;
  preferred_username?: string | undefined;
  oid?: string | undefined;
  picture?: string | undefined;
}

export interface AzureAdFetchDiagnostics {
  nodeFetchHonorsHttpProxyEnv: boolean;
  customProxyApplied: boolean;
  proxyConfigured: boolean;
  proxySource?: string | undefined;
  proxyHost?: string | undefined;
  proxyProtocol?: string | undefined;
  proxyHasCredentials?: boolean | undefined;
  proxyParseError?: string | undefined;
}

interface AzureAdFetchContext {
  stage: string;
  provider: "azure-ad" | "microsoft-graph";
}

interface AzureAdResponseErrorDetails {
  raw: string;
  parsed?: unknown;
}

// Handles Azure AD OAuth2 helpers plus legacy root login utilities.
export class AuthService {

  /**
   * Report how Azure AD outbound HTTP requests will be routed.
   * @returns AzureAdFetchDiagnostics - Proxy and Node fetch proxy behavior.
   * @description Exposes whether custom proxy transport is active for Entra ID diagnostics.
   */
  getAzureAdFetchDiagnostics(): AzureAdFetchDiagnostics {
    const proxyUrl = config.azureAd.proxyUrl;
    if (!proxyUrl) {
      return {
        nodeFetchHonorsHttpProxyEnv: false,
        customProxyApplied: false,
        proxyConfigured: false,
        proxySource: config.azureAd.proxySource,
      };
    }

    try {
      const parsedProxyUrl = new URL(proxyUrl);

      return {
        nodeFetchHonorsHttpProxyEnv: false,
        customProxyApplied: true,
        proxyConfigured: true,
        proxySource: config.azureAd.proxySource,
        proxyHost: parsedProxyUrl.host,
        proxyProtocol: parsedProxyUrl.protocol,
        proxyHasCredentials: !!parsedProxyUrl.username || !!parsedProxyUrl.password,
      };
    } catch (error) {
      return {
        nodeFetchHonorsHttpProxyEnv: false,
        customProxyApplied: true,
        proxyConfigured: true,
        proxySource: config.azureAd.proxySource,
        proxyParseError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch an Azure AD or Microsoft Graph URL with request diagnostics.
   * @param url - Target URL.
   * @param options - Fetch options.
   * @param context - Request stage metadata.
   * @returns Promise<Response> - HTTP response.
   * @description Uses explicit proxy transport when Azure proxy config is present.
   */
  private async fetchMicrosoftResource(
    url: string,
    options: RequestInit,
    context: AzureAdFetchContext
  ): Promise<Response> {
    const diagnostics = this.getAzureAdFetchDiagnostics();
    const targetUrl = new URL(url);

    log.debug("Microsoft auth outbound request started", {
      ...context,
      method: options.method ?? "GET",
      host: targetUrl.host,
      path: targetUrl.pathname,
      proxy: diagnostics,
    });

    try {
      const response = diagnostics.customProxyApplied
        ? await this.fetchViaHttpProxy(url, options, context)
        : await fetch(url, options);

      log.debug("Microsoft auth outbound request completed", {
        ...context,
        status: response.status,
        ok: response.ok,
        requestId: this.getResponseHeader(response, "request-id") ?? this.getResponseHeader(response, "x-ms-request-id"),
        clientRequestId: this.getResponseHeader(response, "client-request-id"),
        proxy: diagnostics,
      });

      return response;
    } catch (error) {
      log.error("Microsoft auth outbound request failed", {
        ...context,
        host: targetUrl.host,
        proxy: diagnostics,
        error: this.serializeError(error),
      });
      throw error;
    }
  }

  /**
   * Fetch an HTTPS Microsoft endpoint through an HTTP proxy.
   * @param url - Target URL.
   * @param options - Fetch options.
   * @param context - Request stage metadata.
   * @returns Promise<Response> - Fetch-compatible response.
   * @description Uses https-proxy-agent because Node fetch does not honor HTTP_PROXY automatically.
   */
  private async fetchViaHttpProxy(
    url: string,
    options: RequestInit,
    context: AzureAdFetchContext
  ): Promise<Response> {
    const proxyUrl = config.azureAd.proxyUrl;

    if (!proxyUrl) {
      return fetch(url, options);
    }

    const targetUrl = new URL(url);
    const headers = this.normalizeHeaders(options.headers);
    const body = this.normalizeRequestBody(options.body);
    const agent = new HttpsProxyAgent(proxyUrl);

    if (targetUrl.protocol !== "https:") {
      throw new Error("Microsoft auth proxy transport only supports HTTPS targets");
    }

    if (body && !headers["content-length"]) {
      headers["content-length"] = Buffer.byteLength(body).toString();
    }

    return new Promise<Response>((resolve, reject) => {
      const request = httpsRequest(
        targetUrl,
        {
          method: options.method ?? "GET",
          headers,
          agent,
        },
        (proxyResponse) => {
          const chunks: Buffer[] = [];

          proxyResponse.on("data", (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          proxyResponse.on("end", () => {
            const responseHeaders = new Headers();

            Object.entries(proxyResponse.headers).forEach(([headerName, headerValue]) => {
              if (Array.isArray(headerValue)) {
                headerValue.forEach((value) => responseHeaders.append(headerName, value));
              } else if (headerValue !== undefined) {
                responseHeaders.set(headerName, headerValue);
              }
            });

            const responseInit: ResponseInit = {
              status: proxyResponse.statusCode ?? 502,
              headers: responseHeaders,
              ...(proxyResponse.statusMessage ? { statusText: proxyResponse.statusMessage } : {}),
            };

            resolve(new Response(Buffer.concat(chunks), responseInit));
          });
        }
      );

      request.on("error", (error) => {
        log.error("Microsoft auth proxy request failed", {
          ...context,
          targetHost: targetUrl.host,
          proxySource: config.azureAd.proxySource,
          error: this.serializeError(error),
        });
        reject(error);
      });

      if (body) {
        request.write(body);
      }

      request.end();
    });
  }

  /**
   * Normalize fetch headers into a Node request header record.
   * @param headers - Fetch headers input.
   * @returns Record<string, string> - Headers for http/https request.
   * @description Converts Headers, array tuples, or plain objects to lowercase keys.
   */
  private normalizeHeaders(headers: RequestInit["headers"] | undefined): Record<string, string> {
    if (!headers) {
      return {};
    }

    if (headers instanceof Headers) {
      return Object.fromEntries(
        Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value])
      );
    }

    if (Array.isArray(headers)) {
      const normalizedHeaders: Record<string, string> = {};

      headers.forEach((header) => {
        const key = header[0];
        const value = header[1];

        if (key) {
          normalizedHeaders[key.toLowerCase()] = String(value ?? "");
        }
      });

      return normalizedHeaders;
    }

    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
    );
  }

  /**
   * Normalize request body values used by Azure auth calls.
   * @param body - Fetch body input.
   * @returns string | Buffer | undefined - Node request body.
   * @description Supports string and Buffer bodies used by this service.
   */
  private normalizeRequestBody(body: RequestInit["body"] | null | undefined): string | Buffer | undefined {
    if (body === null || body === undefined) {
      return undefined;
    }

    if (typeof body === "string" || Buffer.isBuffer(body)) {
      return body;
    }

    if (body instanceof URLSearchParams) {
      return body.toString();
    }

    throw new Error("Unsupported proxied Microsoft auth request body type");
  }

  /**
   * Read and parse a failed Microsoft identity response for logs.
   * @param response - HTTP response from Azure AD or Graph.
   * @returns Promise<AzureAdResponseErrorDetails> - Truncated raw and parsed body.
   * @description Keeps failed-response logging detailed without leaking successful tokens.
   */
  private async readMicrosoftErrorResponse(response: Response): Promise<AzureAdResponseErrorDetails> {
    const raw = typeof response.text === "function"
      ? (await response.text()).substring(0, 1500)
      : "";

    try {
      return {
        raw,
        parsed: JSON.parse(raw),
      };
    } catch (error) {
      return { raw };
    }
  }

  /**
   * Safely read a response header from real Response objects or lightweight tests.
   * @param response - HTTP response.
   * @param headerName - Header name.
   * @returns string | null - Header value when present.
   * @description Prevents diagnostics logging from failing on minimal fetch mocks.
   */
  private getResponseHeader(response: Response, headerName: string): string | null {
    return response.headers?.get?.(headerName) ?? null;
  }

  /**
   * Convert unknown errors into structured log metadata.
   * @param error - Unknown thrown value.
   * @returns Record<string, unknown> - Safe error metadata.
   * @description Captures common Node network error fields without exposing request secrets.
   */
  private serializeError(error: unknown): Record<string, unknown> {
    if (!(error instanceof Error)) {
      return { message: String(error) };
    }

    const nodeError = error as Error & {
      code?: string;
      errno?: number;
      syscall?: string;
      hostname?: string;
      cause?: unknown;
    };

    return {
      name: error.name,
      message: error.message,
      code: nodeError.code,
      errno: nodeError.errno,
      syscall: nodeError.syscall,
      hostname: nodeError.hostname,
      cause: nodeError.cause instanceof Error ? nodeError.cause.message : nodeError.cause,
    };
  }

  /**
   * Build Azure authorization URL including offline_access.
   * @param state - CSRF state token.
   * @returns string - The constructed authorization URL.
   * @description Constructs the OAuth2 authorization URL for Azure AD.
   */
  getAuthorizationUrl(state: string): string {
    // Construct URL parameters
    const params = new URLSearchParams({
      client_id: config.azureAd.clientId,
      response_type: "code",
      redirect_uri: config.azureAd.redirectUri,
      response_mode: "query",
      // offline_access scope enables refresh tokens
      scope: "openid profile email User.Read offline_access",
      state,
    });

    // Return full authorization URL
    return `https://login.microsoftonline.com/${config.azureAd.tenantId
      }/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange one-time auth code for access/refresh tokens.
   * @param code - Authorization code from the callback.
   * @returns Promise<TokenResponse> - The token response containing access and refresh tokens.
   * @description Exchanges the authorization code for tokens via Azure AD token endpoint.
   */
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const tokenEndpoint = `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/token`;

    // Prepare token endpoint parameters
    const params = new URLSearchParams({
      client_id: config.azureAd.clientId,
      client_secret: config.azureAd.clientSecret,
      code,
      redirect_uri: config.azureAd.redirectUri,
      grant_type: "authorization_code",
      // offline_access scope enables refresh tokens
      scope: "openid profile email User.Read offline_access",
    });

    // Send POST request to token endpoint
    const response = await this.fetchMicrosoftResource(
      tokenEndpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      {
        stage: "token_exchange",
        provider: "azure-ad",
      }
    );

    // Handle non-successful responses
    if (!response.ok) {
      const error = await this.readMicrosoftErrorResponse(response);
      log.error('Azure AD Token exchange failed', {
        status: response.status,
        statusText: response.statusText,
        requestId: this.getResponseHeader(response, "request-id") ?? this.getResponseHeader(response, "x-ms-request-id"),
        clientRequestId: this.getResponseHeader(response, "client-request-id"),
        error,
        proxy: this.getAzureAdFetchDiagnostics(),
      });
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    // Return parsed JSON response
    const tokens = await response.json() as TokenResponse;
    log.info("Azure AD token exchange successful", {
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
      proxy: this.getAzureAdFetchDiagnostics(),
    });

    return tokens;
  }

  /**
   * Refresh access token when a refresh token is available.
   * @param refreshToken - The refresh token to use.
   * @returns Promise<TokenResponse> - The new token response.
   * @description Refreshes an expired access token using the refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tokenEndpoint = `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/token`;

    // Prepare refresh token parameters
    const params = new URLSearchParams({
      client_id: config.azureAd.clientId,
      client_secret: config.azureAd.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "openid profile email User.Read offline_access",
    });

    log.debug("Attempting to refresh access token");

    // Send POST request to token endpoint
    const response = await this.fetchMicrosoftResource(
      tokenEndpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      {
        stage: "token_refresh",
        provider: "azure-ad",
      }
    );

    // Handle token refresh errors
    if (!response.ok) {
      const error = await this.readMicrosoftErrorResponse(response);
      log.error("Token refresh failed", {
        status: response.status,
        statusText: response.statusText,
        requestId: this.getResponseHeader(response, "request-id") ?? this.getResponseHeader(response, "x-ms-request-id"),
        clientRequestId: this.getResponseHeader(response, "client-request-id"),
        error,
        proxy: this.getAzureAdFetchDiagnostics(),
      });
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    // Parse successfully refreshed tokens
    const tokens = (await response.json()) as TokenResponse;
    log.debug("Token refresh successful", {
      expiresIn: tokens.expires_in,
      hasNewRefreshToken: !!tokens.refresh_token,
    });

    return tokens;
  }

  /**
   * Check if a token is expired.
   * @param expiresAt - Expiration timestamp in milliseconds.
   * @param bufferSeconds - Buffer time in seconds to treat near-expiry as expired.
   * @returns boolean - True if token is expired (or close to), false otherwise.
   * @description Checks expiration status with a safety buffer.
   */
  isTokenExpired(expiresAt: number | undefined, bufferSeconds: number = 300): boolean {
    if (!expiresAt) return true;
    const now = Date.now();
    // Calculate expiry time with buffer subtracted
    const expiryWithBuffer = expiresAt - bufferSeconds * 1000;
    // Compare current time with buffered expiry
    return now >= expiryWithBuffer;
  }

  /**
   * Generate deterministic avatar for users without profile photos.
   * @param displayName - User's display name.
   * @returns string - URL to the generated avatar.
   * @description Generates a UI Avatars URL based on the user's name.
   */
  generateFallbackAvatar(displayName: string): string {
    const encodedName = encodeURIComponent(displayName || "User");
    return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=fff&size=128`;
  }

  /**
   * Pull user profile and optional photo from Microsoft Graph.
   * @param accessToken - The access token for Graph API.
   * @returns Promise<AzureAdUser> - The user profile data.
   * @description Fetches user details and profile photo from Microsoft Graph.
   */
  async getUserProfile(accessToken: string): Promise<AzureAdUser> {
    const profileEndpoint =
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle,mobilePhone";

    // Fetch profile data from Graph API
    const response = await this.fetchMicrosoftResource(
      profileEndpoint,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      {
        stage: "graph_profile",
        provider: "microsoft-graph",
      }
    );

    // Throw error if profile fetch fails
    if (!response.ok) {
      const error = await this.readMicrosoftErrorResponse(response);
      log.error("Microsoft Graph profile fetch failed", {
        status: response.status,
        statusText: response.statusText,
        requestId: this.getResponseHeader(response, "request-id") ?? this.getResponseHeader(response, "x-ms-request-id"),
        clientRequestId: this.getResponseHeader(response, "client-request-id"),
        error,
        proxy: this.getAzureAdFetchDiagnostics(),
      });
      throw new Error("Failed to fetch user profile");
    }

    // Parse profile data
    const profile = (await response.json()) as {
      id: string;
      displayName?: string;
      mail?: string;
      userPrincipalName?: string;
      department?: string;
      jobTitle?: string;
      mobilePhone?: string;
    };

    const displayName = profile.displayName ?? "";
    // Use mail first, fall back to userPrincipalName
    const email = profile.mail ?? profile.userPrincipalName ?? "";

    log.info("Microsoft Graph profile fetched", {
      userId: profile.id,
      email,
      hasDepartment: !!profile.department,
      hasJobTitle: !!profile.jobTitle,
      hasMobilePhone: !!profile.mobilePhone,
      proxy: this.getAzureAdFetchDiagnostics(),
    });

    // Try to fetch user's profile photo from Azure AD
    let avatar: string | undefined;
    try {
      const photoResponse = await this.fetchMicrosoftResource(
        "https://graph.microsoft.com/v1.0/me/photo/$value",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        {
          stage: "graph_photo",
          provider: "microsoft-graph",
        }
      );

      if (photoResponse.ok) {
        // Convert photo to base64 data URL
        const photoBlob = await photoResponse.arrayBuffer();
        const base64 = Buffer.from(photoBlob).toString("base64");
        const contentType =
          photoResponse.headers.get("content-type") ?? "image/jpeg";
        avatar = `data:${contentType};base64,${base64}`;
        log.debug("User avatar fetched from Azure AD", { userId: profile.id });
      } else {
        log.debug("Azure AD photo not available, using fallback", {
          userId: profile.id,
          status: photoResponse.status,
        });
      }
    } catch (err) {
      log.debug("Failed to fetch Azure AD photo, using fallback", {
        userId: profile.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Generate fallback avatar if Azure photo not available
    if (!avatar) {
      avatar = this.generateFallbackAvatar(displayName);
    }

    // Return constructed user profile object
    return {
      id: profile.id,
      email,
      name: displayName,
      displayName,
      avatar,
      department: profile.department,
      jobTitle: profile.jobTitle,
      mobilePhone: profile.mobilePhone,
    };
  }

  /**
   * Generate CSRF mitigation token.
   * @returns string - Random UUID for state parameter.
   * @description Generates a random state token for OAuth flow.
   */
  generateState(): string {
    return crypto.randomUUID();
  }


  /**
   * Login placeholder for simple auth (not Azure AD).
   * @param username - Username or email.
   * @param password - Password.
   * @param ipAddress - Client IP address.
   * @returns Promise<any> - User object if successful.
   * @description Supports root-user login and test user login with TEST_PASSWORD.
   */
  async login(username: string, password: string, ipAddress?: string): Promise<any> {
    // Check against configured root credentials
    if (config.enableRootLogin && username === config.rootUser && password === config.rootPassword) {
      const user = {
        id: 'root-user',
        email: username,
        role: 'admin',
        displayName: 'System Administrator'
      };

      // Record IP history asynchronously
      if (ipAddress) {
        try {
          // Ensure root user exists in users table to satisfy FK constraint
          try {
            const rootUser = await ModelFactory.user.findById(user.id);
            if (!rootUser) {
              await ModelFactory.user.create({
                id: user.id,
                email: user.email,
                display_name: user.displayName,
                role: user.role,
                permissions: JSON.stringify(['*'])
              });
            }
          } catch (userErr) {
            log.warn('Failed to ensure root user existence', { error: String(userErr) });
          }

          // Check for existing history record
          const existingHistory = await ModelFactory.userIpHistory.findByUserAndIp(user.id, ipAddress);
          if (existingHistory) {
            // Update last accessed timestamp
            await ModelFactory.userIpHistory.update(existingHistory.id, { last_accessed_at: new Date() });
          } else {
            // Create new history record
            await ModelFactory.userIpHistory.create({
              user_id: user.id,
              ip_address: ipAddress,
              last_accessed_at: new Date()
            });
          }
        } catch (error) {
          log.warn('Failed to save IP history', { error: String(error) });
        }
      }

      return { user };
    }

    // Check for test user login with TEST_PASSWORD
    // This allows sample users to login using the TEST_PASSWORD env variable
    if (config.enableRootLogin && config.testPassword && password === config.testPassword) {
      // Look up user by email in database
      const dbUser = await ModelFactory.user.findByEmail(username);

      if (dbUser) {
        log.info('Test user login successful', { email: username, userId: dbUser.id });

        // Record IP history for test users
        if (ipAddress) {
          try {
            const existingHistory = await ModelFactory.userIpHistory.findByUserAndIp(dbUser.id, ipAddress);
            if (existingHistory) {
              await ModelFactory.userIpHistory.update(existingHistory.id, { last_accessed_at: new Date() });
            } else {
              await ModelFactory.userIpHistory.create({
                user_id: dbUser.id,
                ip_address: ipAddress,
                last_accessed_at: new Date()
              });
            }
          } catch (error) {
            log.warn('Failed to save IP history for test user', { error: String(error) });
          }
        }

        // Return user with parsed permissions
        const permissions = typeof dbUser.permissions === 'string'
          ? JSON.parse(dbUser.permissions)
          : dbUser.permissions;

        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role,
            displayName: dbUser.display_name,
            permissions
          }
        };
      }
    }

    // Log failed login attempt
    log.warn('Failed login attempt', {
      username,
      ipAddress,
      isRootEnabled: config.enableRootLogin,
      isRootUser: username === config.rootUser
    });

    throw new Error('Invalid credentials');
  }
}

export const authService = new AuthService();
