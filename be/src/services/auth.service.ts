
import { config } from "@/config/index.js";
import { log } from "@/services/logger.service.js";
import crypto from "crypto";
import { ModelFactory } from "@/models/factory.js";

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

  /**
   * Generates the Azure AD authorization URL.
   *
   * @param state - A random string to prevent CSRF attacks.
   * @returns The constructed authorization URL.
   */
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

  /**
   * Exchanges an authorization code for access and refresh tokens.
   *
   * @param code - The authorization code received from Azure AD.
   * @returns A promise that resolves to the token response containing access and refresh tokens.
   * @throws Error if the token exchange fails.
   */
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

  /**
   * Refreshes an expired access token using a refresh token.
   *
   * @param refreshToken - The refresh token to use for obtaining a new access token.
   * @returns A promise that resolves to the new token response.
   * @throws Error if the token refresh fails.
   */
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

  /**
   * Checks if a token is expired or about to expire.
   *
   * @param expiresAt - The timestamp (in milliseconds) when the token expires.
   * @param bufferSeconds - The buffer time in seconds to treat the token as expired before the actual expiry (default: 300).
   * @returns True if the token is expired or within the buffer period, false otherwise.
   */
  isTokenExpired(expiresAt: number | undefined, bufferSeconds: number = 300): boolean {
    if (!expiresAt) return true;
    const now = Date.now();
    const expiryWithBuffer = expiresAt - bufferSeconds * 1000;
    return now >= expiryWithBuffer;
  }

  /**
   * Generates a fallback avatar URL using UI Avatars.
   *
   * @param displayName - The name to display in the avatar.
   * @returns The URL of the generated avatar.
   */
  generateFallbackAvatar(displayName: string): string {
    const encodedName = encodeURIComponent(displayName || "User");
    return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=fff&size=128`;
  }

  /**
   * Fetches the user's profile from Microsoft Graph.
   *
   * @param accessToken - The access token to authorize the request.
   * @returns A promise that resolves to the user's Azure AD profile.
   * @throws Error if the profile fetch fails.
   */
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

  /**
   * Generates a random state string for OAuth security.
   *
   * @returns A random UUID string.
   */
  generateState(): string {
    return crypto.randomUUID();
  }


  /**
   * Authenticates a user using a username and password.
   * Currently supports root user login and logs IP history.
   *
   * @param username - The username provided.
   * @param password - The password provided.
   * @param ipAddress - The IP address of the client (optional).
   * @returns A promise that resolves to an object containing the user details.
   * @throws Error if authentication fails.
   */
  async login(username: string, password: string, ipAddress?: string): Promise<any> {
    // Root user login
    if (config.enableRootLogin && username === config.rootUser && password === config.rootPassword) {
      const user = {
        id: 'root-user',
        email: username,
        role: 'admin',
        displayName: 'System Administrator'
      };

      // Record IP history asynchronously
      if (ipAddress) {
        // We wrap this in try-catch to avoid blocking login if DB fails (e.g., FK constraint for root-user)
        try {
          // Check if user exists in DB to avoid FK error
          // The root user might not be in the 'users' table if not initialized.
          // We ensure root user exists in users table to satisfy FK constraint for IP history.
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

          // Record or update the IP history
          const existingHistory = await ModelFactory.userIpHistory.findByUserAndIp(user.id, ipAddress);
          if (existingHistory) {
            await ModelFactory.userIpHistory.update(existingHistory.id, { last_accessed_at: new Date() });
          } else {
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
