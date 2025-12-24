
import { Router } from 'express';
import { authService } from '@/services/auth.service.js';
import { userService } from '@/services/user.service.js';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { getClientIp } from '@/utils/ip.js';
import { requireAuth, getCurrentUser, updateAuthTimestamp } from '@/middleware/auth.middleware.js';

const router = Router();

router.get('/config', (req, res) => {
  res.json({
    enableRootLogin: config.enableRootLogin,
    azureAd: {
      clientId: config.azureAd.clientId,
      tenantId: config.azureAd.tenantId,
      redirectUri: config.azureAd.redirectUri
    }
  });
});

router.get('/me', async (req, res) => {
  if (req.session?.user) {
    // Record IP for session resume / auto-login
    try {
      const ipAddress = getClientIp(req);
      if (ipAddress) {
        // We import userService at the top, verify it's available
        await userService.recordUserIp(req.session.user.id, ipAddress);
      }
    } catch (error) {
      log.warn('Failed to record IP on session resume', { error: String(error) });
    }

    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

router.get('/login', (req, res) => {
  const state = authService.generateState();
  req.session.oauthState = state;
  res.redirect(authService.getAuthorizationUrl(state));
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    log.error('Azure AD login error', { error });
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${config.frontendUrl}/login?error=no_code`);
    return;
  }

  if (state !== req.session.oauthState) {
    log.warn('State mismatch in OAuth callback');
    res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
    return;
  }

  try {
    const tokens = await authService.exchangeCodeForTokens(code);
    const adUser = await authService.getUserProfile(tokens.access_token);
    const ipAddress = getClientIp(req);

    const user = await userService.findOrCreateUser(adUser, ipAddress);

    req.session.user = {
      ...user,
      displayName: user.display_name as string,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
    };

    // Explicitly set optional properties if they exist, cast to any to bypass strict type checks
    if (adUser.avatar) {
      (req.session.user as any).avatar = adUser.avatar;
    }

    req.session.accessToken = tokens.access_token as any;
    req.session.refreshToken = tokens.refresh_token as any;
    req.session.tokenExpiresAt = (Date.now() + (tokens.expires_in * 1000)) as any;

    updateAuthTimestamp(req, false);

    req.session.save((err) => {
      if (err) {
        log.error('Session save failed in OAuth callback', {
          error: err.message,
          userId: user.id,
          email: user.email
        });
        res.redirect(`${config.frontendUrl}/login?error=session_error`);
        return;
      }
      log.info('Successful Azure AD login', { userId: user.id, email: user.email });
      res.redirect(config.frontendUrl);
    });
  } catch (err: any) {
    log.error('Authentication failed', { error: err.message });
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      log.error('Logout failed', { error: err.message });
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.json({ message: 'Logged out successfully' });
  });
});

router.post('/reauth', requireAuth, async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (user.id === 'root-user') {
    const { password } = req.body;
    const rootPass = config.rootPassword;
    const crypto = await import('crypto');

    const passwordMatch = crypto.timingSafeEqual(
      Buffer.from(password.padEnd(256, '\0')),
      Buffer.from(rootPass.padEnd(256, '\0'))
    );

    if (!passwordMatch) {
      log.warn('Failed root re-authentication attempt', { userId: user.id });
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
  }

  updateAuthTimestamp(req, true);
  res.json({ success: true });
});

router.post('/refresh-token', requireAuth, async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (user.id === 'root-user') {
    res.json({ success: true, message: 'Root user does not use tokens' });
    return;
  }

  const refreshToken = req.session.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'NO_REFRESH_TOKEN' });
    return;
  }

  try {
    const newTokens = await authService.refreshAccessToken(refreshToken);
    req.session.accessToken = newTokens.access_token as any;
    req.session.tokenExpiresAt = (Date.now() + (newTokens.expires_in * 1000)) as any;
    if (newTokens.refresh_token) req.session.refreshToken = newTokens.refresh_token as any;

    req.session.save(() => {
      res.json({ success: true, expiresIn: newTokens.expires_in });
    });
  } catch (e) {
    res.status(401).json({ error: 'TOKEN_REFRESH_FAILED' });
  }
});

router.get('/token-status', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  res.json({ hasToken: !!req.session.accessToken });
});

router.post('/login/root', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password, getClientIp(req));
    req.session.user = {
      ...result.user,
      permissions: result.user.permissions || ['*'],
      display_name: result.user.displayName,
      displayName: result.user.displayName, // Map for compatibility
      created_at: new Date(),
      updated_at: new Date()
    };
    updateAuthTimestamp(req, false);
    req.session.save(() => {
      res.json(result);
    });
  } catch (e) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;
