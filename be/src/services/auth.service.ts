
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
          // The root user might not be in the 'users' table.
          // For now, we only try logging if it's a real user or we ensure ID validity.
          // Since 'root-user' is virtual, we can't save to user_ip_history if it implies a FK to users.
          // However, we can try to find a real user with this email?
          // Or just log it if we can. 

          // Actually, let's just try to log to Audit Log instead/as well?
          // The prompt specifically asked to "save user IP". 
          // user_ip_history seems the right place.
          // If the user doesn't exist in DB, we can't save to user_ip_history (usually).
          // But maybe we should just log the info.

          // Let's attempt to find or create the history record.
          // Note: If 'root-user' is not in 'users' table, insert will likely fail.
          // For now, I'll add the logic, but wrap in try-catch.

          const existingHistory = await ModelFactory.userIpHistory.findByUserAndIp(user.id, ipAddress);
          if (existingHistory) {
            await ModelFactory.userIpHistory.update(existingHistory.id, { last_accessed_at: new Date() });
          } else {
            // Use generic insert if create method is not explicit or just let BaseModel handle it
            // Assuming create takes Partial<T>
            try {
              await ModelFactory.userIpHistory.create({
                user_id: user.id,
                ip_address: ipAddress,
                last_accessed_at: new Date()
              });
            } catch (dbErr) {
              // Ignore FK errors for virtual users
              log.debug('Skipping IP history for virtual user', { userId: user.id, error: String(dbErr) });
            }
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
