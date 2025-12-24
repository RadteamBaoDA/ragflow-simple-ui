
import { config } from "@/config/index.js";
import { log } from "@/services/logger.service.js";
import crypto from "crypto";

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

export class AuthService {

  // Move standalone functions into class methods or keep as utility exports?
  // Request asked to refactor services. Usually services are classes/singletons in this codebase.
  // The previous file exported functions.
  // I will wrap them in a class AuthService and export singleton instance.

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.azureAd.clientId,
      response_type: "code",
      redirect_uri: config.azureAd.redirectUri,
      response_mode: "query",
      // offline_access scope enables refresh tokens
      scope: "openid profile email User.Read offline_access",
      state,
    });

    return `https://login.microsoftonline.com/${config.azureAd.tenantId
      }/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
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
      log.error('Azure AD Token exchange failed', {
        status: response.status,
        error: error.substring(0, 500)
      });
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
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

  isTokenExpired(expiresAt: number | undefined, bufferSeconds: number = 300): boolean {
    if (!expiresAt) return true;
    const now = Date.now();
    const expiryWithBuffer = expiresAt - bufferSeconds * 1000;
    return now >= expiryWithBuffer;
  }

  generateFallbackAvatar(displayName: string): string {
    const encodedName = encodeURIComponent(displayName || "User");
    return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=fff&size=128`;
  }

  async getUserProfile(accessToken: string): Promise<AzureAdUser> {
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
      avatar = this.generateFallbackAvatar(displayName);
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

  generateState(): string {
    return crypto.randomUUID();
  }

  // Login placeholder for simple auth (not Azure AD) if used by AuthController
  async login(username: string, password: string, ipAddress?: string): Promise<any> {
    // Root user login
    if (config.enableRootLogin && username === config.rootUser && password === config.rootPassword) {
      return {
        user: {
          id: 'root-user',
          email: username,
          role: 'admin',
          displayName: 'System Administrator'
        }
      };
    }

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
