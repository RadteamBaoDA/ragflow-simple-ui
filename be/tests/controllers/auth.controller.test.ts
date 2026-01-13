import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthController } from '@/controllers/auth.controller.js'
import { authService } from '@/services/auth.service.js'
import { userService } from '@/services/user.service.js'
import { config } from '@/config/index.js'

const makeReq = (overrides: any = {}) => ({ session: {}, body: {}, query: {}, headers: {}, ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, ...overrides }) as any
const makeRes = () => {
  const json = vi.fn()
  const redirect = vi.fn()
  const status = vi.fn(() => ({ json }))
  return { json, redirect, status } as any
}

describe('AuthController', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getAuthConfig returns config', async () => {
    const c = new AuthController()
    const req = makeReq()
    const res = makeRes()
    await c.getAuthConfig(req, res)
    expect(res.json).toHaveBeenCalled()
  })

  it('getMe returns 401 if no session', async () => {
    const c = new AuthController()
    const req = makeReq({ session: {} })
    const res = makeRes()
    await c.getMe(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('getMe returns user when session valid', async () => {
    const c = new AuthController()
    const req = makeReq({ session: { user: { id: 'u1' } } })
    const res = makeRes()
    vi.spyOn(userService, 'getUserById').mockResolvedValue({ id: 'u1' } as any)
    vi.spyOn(userService, 'recordUserIp').mockResolvedValue(undefined)
    await c.getMe(req, res)
    expect(res.json).toHaveBeenCalledWith({ id: 'u1' })
  })

  it('loginAzureAd sets state and redirects', async () => {
    const c = new AuthController()
    const req = makeReq({ session: {} })
    const res = makeRes()
    vi.spyOn(authService, 'generateState').mockReturnValue('s')
    vi.spyOn(authService, 'getAuthorizationUrl').mockReturnValue('https://auth')
    await c.loginAzureAd(req, res)
    expect(req.session.oauthState).toBe('s')
    expect(res.redirect).toHaveBeenCalledWith('https://auth')
  })

  it('handleCallback redirects on error or invalid code/state', async () => {
    const c = new AuthController()
    const req1 = makeReq({ query: { error: 'e' }, session: { oauthState: 's' } })
    const res1 = makeRes()
    await c.handleCallback(req1, res1)
    expect(res1.redirect).toHaveBeenCalled()

    const req2 = makeReq({ query: { state: 'x' }, session: { oauthState: 's' } })
    const res2 = makeRes()
    await c.handleCallback(req2, res2)
    expect(res2.redirect).toHaveBeenCalled()
  })

  it('logout destroys session and returns message', async () => {
    const c = new AuthController()
    const req = makeReq({ session: { destroy: (cb: any) => cb(null) } })
    const res = makeRes()
    await c.logout(req, res)
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' })
  })

  it('reauth returns 401 when not authenticated', async () => {
    const c = new AuthController()
    const req = makeReq({})
    const res = makeRes()
    await c.reauth(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('refreshToken handles missing or valid tokens', async () => {
    const c = new AuthController()
    const req = makeReq({ session: {} })
    const res = makeRes()
    await c.refreshToken(req, res)
    expect(res.status).toHaveBeenCalledWith(401)

    const req2 = makeReq({ session: { refreshToken: 'r' }, session: { refreshToken: 'r', save: (cb: any) => cb() } })
    const res2 = makeRes()
    vi.spyOn(authService, 'refreshAccessToken').mockResolvedValue({ access_token: 'a', expires_in: 60 })
    await c.refreshToken(req2, res2)
    expect(res2.json).toHaveBeenCalled()
  })

  it('getTokenStatus returns hasToken', async () => {
    const c = new AuthController()
    const req = makeReq({ session: { accessToken: 'a' } })
    const res = makeRes()
    await c.getTokenStatus(req, res)
    expect(res.json).toHaveBeenCalledWith({ hasToken: true })
  })

  it('loginRoot returns 401 on invalid credentials and sets session on success', async () => {
    const c = new AuthController()
    const req = makeReq({ body: { username: 'u', password: 'p' }, session: { save: (cb: any) => cb() } })
    const res = makeRes()
    vi.spyOn(authService, 'login').mockRejectedValue(new Error('no'))
    await c.loginRoot(req, res)
    expect(res.status).toHaveBeenCalledWith(401)

    vi.spyOn(authService, 'login').mockResolvedValue({ user: { id: 'root' } } as any)
    await c.loginRoot(req, res)
    expect(res.json).toHaveBeenCalled()
  })
})
