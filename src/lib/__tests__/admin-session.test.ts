import { describe, expect, it } from 'vitest'
import { createSessionToken, safeEqual, verifySessionToken } from '../admin-session'

describe('safeEqual', () => {
  it('matches equal strings and rejects differing content or length', () => {
    expect(safeEqual('secret', 'secret')).toBe(true)
    expect(safeEqual('secret', 'secreT')).toBe(false)
    expect(safeEqual('secret', 'secret1')).toBe(false)
    expect(safeEqual('secret1', 'secret')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
    expect(safeEqual('', 'a')).toBe(false)
  })
})

describe('session token', () => {
  it('round-trips and rejects tampering', async () => {
    const token = await createSessionToken('s3cret')
    expect(await verifySessionToken(token, 's3cret')).toBe(true)
    expect(await verifySessionToken(token, 'other')).toBe(false)
    expect(await verifySessionToken(`${token}x`, 's3cret')).toBe(false)
    expect(await verifySessionToken(undefined, 's3cret')).toBe(false)
  })
})
