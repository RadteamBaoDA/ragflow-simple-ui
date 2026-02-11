
import { config } from "@/shared/config/index.js";
import { log } from "@/shared/services/logger.service.js";
import crypto from "crypto";
import { ModelFactory } from "@/shared/models/factory.js";

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

// Handles Azure AD OAuth2 helpers plus legacy root login utilities.
export class AuthService {

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

    // Handle non-successful responses
    if (!response.ok) {
      const error = await response.text();
      log.error('Azure AD Token exchange failed', {
        status: response.status,
        error: error.substring(0, 500)
      });
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    // Return parsed JSON response
    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Refresh access token when a refresh token is available.
   * @param refreshToken - The refresh token to use.
   * @returns Promise<TokenResponse> - The new token response.
   * @description Refreshes an expired access token using the refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
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

    // Handle token refresh errors
    if (!response.ok) {
      const errorText = await response.text();
      log.error("Token refresh failed", {
        status: response.status,
        error: errorText.substring(0, 200),
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
    // Fetch profile data from Graph API
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle,mobilePhone",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Throw error if profile fetch fails
    if (!response.ok) {
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
