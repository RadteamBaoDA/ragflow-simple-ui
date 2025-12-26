/**
 * @fileoverview Unit tests for getClientIp utility.
 */

import { describe, it, expect } from 'vitest'
import { getClientIp } from '../../src/utils/ip.js'

function buildRequest(overrides: Partial<Record<string, any>> = {}) {
  return {
    headers: {},
    socket: { remoteAddress: undefined },
    ...overrides,
  } as any
}

describe('getClientIp', () => {
  it('returns first IP from x-forwarded-for', () => {
    const req = buildRequest({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } })

    const ip = getClientIp(req)

    expect(ip).toBe('1.1.1.1')
  })

  it('falls back to x-real-ip', () => {
    const req = buildRequest({ headers: { 'x-real-ip': '3.3.3.3' } })

    const ip = getClientIp(req)

    expect(ip).toBe('3.3.3.3')
  })

  it('uses socket remoteAddress when no headers', () => {
    const req = buildRequest({ socket: { remoteAddress: '4.4.4.4' } })

    const ip = getClientIp(req)

    expect(ip).toBe('4.4.4.4')
  })

  it('returns unknown when nothing available', () => {
    const req = buildRequest()

    const ip = getClientIp(req)

    expect(ip).toBe('unknown')
  })
})
