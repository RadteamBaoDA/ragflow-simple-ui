/**
 * @fileoverview Azure Entra ID (Azure AD) authentication service.
 *
 * This module handles OAuth 2.0 authentication with Azure Entra ID:
 * - Authorization URL generation for login flow
 * - Token exchange for authorization codes
 * - User profile fetching from Microsoft Graph API
 * - Avatar image retrieval and fallback generation
 *
 * OAuth Flow:
 * 1. User clicks login -> getAuthorizationUrl() generates Azure AD URL
 * 2. User authenticates with Microsoft -> Azure redirects with code
 * 3. Backend calls exchangeCodeForTokens() with the code
 * 4. Backend calls getUserProfile() with access token to get user info
 * 5. User data stored in session for subsequent requests
 *
 * @module services/auth
 */

import { config } from "../config/index.js";
import { log } from "./logger.service.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * User information from Azure Entra ID.
 * Represents the authenticated user's profile data.
 */
export interface AzureAdUser {
  /** Unique user identifier from Azure AD (object ID) */
  id: string;
  /** User's email address (from mail or userPrincipalName) */
  email: string;
  /** User's display name */
  name: string;
  /** User's display name (duplicate for compatibility) */
  displayName: string;
  /** Base64-encoded avatar image or fallback URL */
  avatar?: string | undefined;
  /** User's organizational department */
  department?: string | undefined;
  /** User's job title/position */
  jobTitle?: string | undefined;
  /** User's mobile phone number */
  mobilePhone?: string | undefined;
}

/**
 * OAuth 2.0 token response from Azure AD.
 */
export interface TokenResponse {
  /** Access token for API calls */
  access_token: string;
  /** Token type (usually "Bearer") */
  token_type: string;
  /** Token expiration time in seconds */
  expires_in: number;
  /** Granted scopes */
  scope: string;
  /** Refresh token for obtaining new access tokens */
  refresh_token?: string | undefined;
  /** ID token containing user claims */
  id_token?: string | undefined;
}

/**
 * Azure AD profile claims from ID token.
 * Subset of claims that might be included.
 */
export interface AzureAdProfile {
  /** Subject identifier */
  sub: string;
  /** User's name */
  name?: string | undefined;
  /** User's email */
  email?: string | undefined;
  /** Preferred username (usually email) */
  preferred_username?: string | undefined;
  /** Object ID */
  oid?: string | undefined;
  /** Picture URL */
  picture?: string | undefined;
}

// ============================================================================
// OAUTH FLOW FUNCTIONS
// ============================================================================

/**
 * Generate Azure AD authorization URL for OAuth login.
 *
 * This is the first step in the OAuth flow. The returned URL
 * should be used to redirect the user to Azure AD for authentication.
 *
 * Requested scopes:
 * - openid: OpenID Connect authentication
 * - profile: Basic profile information
 * - email: Email address
 * - User.Read: Read user profile from Microsoft Graph
 *
 * @param state - Random state parameter for CSRF protection
 * @returns Full Azure AD authorization URL
 *
 * @example
 * const state = generateState();
 * const url = getAuthorizationUrl(state);
 * res.redirect(url);
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.azureAd.clientId,
    response_type: "code",
    redirect_uri: config.azureAd.redirectUri,
    response_mode: "query",
    // offline_access scope enables refresh tokens
    scope: "openid profile email User.Read offline_access",
    state,
  });

  return `https://login.microsoftonline.com/${
    config.azureAd.tenantId
  }/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens.
 *
 * This is the second step in the OAuth flow, called after
 * the user authenticates and Azure AD redirects back with a code.
 *
 * @param code - Authorization code from Azure AD callback
 * @returns Token response containing access_token and other tokens
 * @throws Error if token exchange fails
 *
 * @example
 * const tokens = await exchangeCodeForTokens(req.query.code);
 * const user = await getUserProfile(tokens.access_token);
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.azureAd.clientId,
    client_secret: config.azureAd.clientSecret,
    code,
    redirect_uri: config.azureAd.redirectUri,
    grant_type: "authorization_code",
    // offline_access scope enables refresh tokens
    scope: "openid profile email User.Read offline_access",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

// ============================================================================
// TOKEN REFRESH FUNCTIONS
// ============================================================================

/**
 * Refresh Azure AD access token using a refresh token.
 *
 * This should be called when the access token is expired or about to expire.
 * The refresh token has a longer lifetime and can be used to get new access tokens
 * without requiring the user to re-authenticate.
 *
 * Token lifetimes (Azure AD defaults):
 * - Access token: 60-90 minutes (configurable in Azure Portal)
 * - Refresh token: 90 days (single-page apps) or until revoked (confidential clients)
 *
 * @param refreshToken - The refresh token from initial authentication
 * @returns New token response with fresh access_token and potentially new refresh_token
 * @throws Error if refresh fails (e.g., refresh token expired or revoked)
 *
 * @example
 * if (isTokenExpired(session.tokenExpiresAt)) {
 *   const newTokens = await refreshAccessToken(session.refreshToken);
 *   session.accessToken = newTokens.access_token;
 *   session.tokenExpiresAt = Date.now() + (newTokens.expires_in * 1000);
 * }
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.azureAd.clientId,
    client_secret: config.azureAd.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "openid profile email User.Read offline_access",
  });

  log.debug("Attempting to refresh access token");

  const response = await fetch(
    `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    log.error("Token refresh failed", {
      status: response.status,
      error: errorText.substring(0, 200),
    });
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const tokens = (await response.json()) as TokenResponse;
  log.debug("Token refresh successful", {
    expiresIn: tokens.expires_in,
    hasNewRefreshToken: !!tokens.refresh_token,
  });

  return tokens;
}

/**
 * Check if an access token is expired or about to expire.
 *
 * @param expiresAt - Unix timestamp (ms) when token expires
 * @param bufferSeconds - Buffer before expiry to consider it expired (default: 5 minutes)
 * @returns True if token is expired or will expire within buffer time
 */
export function isTokenExpired(
  expiresAt: number | undefined,
  bufferSeconds: number = 300
): boolean {
  if (!expiresAt) return true;

  const now = Date.now();
  const expiryWithBuffer = expiresAt - bufferSeconds * 1000;

  return now >= expiryWithBuffer;
}

// ============================================================================
// USER PROFILE FUNCTIONS
// ============================================================================

/**
 * Generate a fallback avatar URL when Azure AD photo is unavailable.
 * Uses the UI Avatars service to generate an avatar from initials.
 *
 * @param displayName - User's display name for generating initials
 * @returns URL to UI Avatars service with encoded name
 */
function generateFallbackAvatar(displayName: string): string {
  const encodedName = encodeURIComponent(displayName || "User");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=fff&size=128`;
}

/**
 * Fetch user profile from Microsoft Graph API.
 *
 * Retrieves user information including:
 * - Basic profile (id, displayName, email)
 * - Organizational info (department, jobTitle)
 * - Contact info (mobilePhone)
 * - Profile photo (if available, converted to base64)
 *
 * If no profile photo is available, a fallback avatar is generated.
 *
 * @param accessToken - Valid Azure AD access token with User.Read scope
 * @returns User profile data
 * @throws Error if profile fetch fails
 *
 * @example
 * const user = await getUserProfile(accessToken);
 * console.log(user.displayName); // "John Doe"
 * console.log(user.avatar); // "data:image/jpeg;base64,..." or fallback URL
 */
export async function getUserProfile(
  accessToken: string
): Promise<AzureAdUser> {
  // Fetch user profile from Microsoft Graph
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle,mobilePhone",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

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
  // Use mail first, fall back to userPrincipalName (for accounts without mail)
  const email = profile.mail ?? profile.userPrincipalName ?? "";

  // Try to fetch user's profile photo from Azure AD
  let avatar: string | undefined;
  try {
    const photoResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/photo/$value",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        // @ts-ignore
        agent,
      }
    );

    if (photoResponse.ok) {
      // Convert photo to base64 data URL for embedding
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
    avatar = generateFallbackAvatar(displayName);
  }

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a random state parameter for OAuth CSRF protection.
 *
 * The state parameter is sent to Azure AD and verified when the
 * callback is received, preventing CSRF attacks.
 *
 * @returns A unique UUID string
 */
export function generateState(): string {
  return crypto.randomUUID();
}
