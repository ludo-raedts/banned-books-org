import { describe, it, expect } from 'vitest'
import { identifyBot } from '@/lib/known-bots'

describe('identifyBot', () => {
  it('matches Googlebot IPv4 in 66.249.64.0/19', () => {
    expect(identifyBot('66.249.65.166')).toBe('Googlebot')
    expect(identifyBot('66.249.95.255')).toBe('Googlebot')
    expect(identifyBot('66.249.96.0')).toBeNull() // outside /19
  })

  it('matches Googlebot IPv6 in 2001:4860:4801::/48', () => {
    expect(identifyBot('2001:4860:4801::1')).toBe('Googlebot')
    expect(identifyBot('2001:4860:4801:ffff::1')).toBe('Googlebot')
    expect(identifyBot('2001:4860:4802::1')).toBeNull() // outside /48
  })

  it('matches Meta crawler in 2a03:2880::/29 (sub-hextet boundary)', () => {
    expect(identifyBot('2a03:2880:f806:6:f800::1')).toBe('Meta crawler')
    expect(identifyBot('2a03:2880:f806:74fa:21c1:615a:c4b5:0')).toBe('Meta crawler')
    // /29 covers 2a03:2880-2887 prefix range
    expect(identifyBot('2a03:2887:ffff::1')).toBe('Meta crawler')
    expect(identifyBot('2a03:2888::1')).toBeNull()
  })

  it('matches Bingbot in published /24 ranges', () => {
    expect(identifyBot('40.77.167.42')).toBe('Bingbot')
    expect(identifyBot('157.55.39.100')).toBe('Bingbot')
    expect(identifyBot('40.77.168.0')).toBeNull()
  })

  it('matches Applebot only in dedicated subnets, not all of 17/8', () => {
    expect(identifyBot('17.58.96.5')).toBe('Applebot')
    expect(identifyBot('17.241.224.5')).toBe('Applebot')
    // 17.0.0.0/8 = all Apple, but iCloud user IPs should NOT be flagged as Applebot
    expect(identifyBot('17.0.0.1')).toBeNull()
    expect(identifyBot('17.100.50.5')).toBeNull()
  })

  it('matches GPTBot ranges', () => {
    expect(identifyBot('20.171.206.42')).toBe('GPTBot')
    expect(identifyBot('52.230.152.10')).toBe('GPTBot')
    expect(identifyBot('132.196.86.5')).toBe('GPTBot')
    expect(identifyBot('20.171.208.0')).toBeNull() // outside /24
  })

  it('matches ChatGPT-User /28 ranges', () => {
    expect(identifyBot('23.98.142.180')).toBe('ChatGPT-User')
    expect(identifyBot('20.169.78.50')).toBe('ChatGPT-User')
    expect(identifyBot('23.98.142.192')).toBeNull() // outside the /28
  })

  it('matches OAI-SearchBot ranges', () => {
    expect(identifyBot('20.42.10.180')).toBe('OAI-SearchBot')
    expect(identifyBot('51.8.102.42')).toBe('OAI-SearchBot')
    expect(identifyBot('135.234.64.50')).toBe('OAI-SearchBot')
  })

  it('matches PerplexityBot exact IPs and small CIDRs', () => {
    expect(identifyBot('107.20.236.150')).toBe('PerplexityBot')
    expect(identifyBot('18.97.1.229')).toBe('PerplexityBot') // inside /30
    expect(identifyBot('18.97.9.100')).toBe('PerplexityBot') // inside /29
    expect(identifyBot('18.97.1.232')).toBeNull() // outside /30
  })

  it('matches Perplexity-User ranges', () => {
    expect(identifyBot('44.208.221.197')).toBe('Perplexity-User')
    expect(identifyBot('18.97.21.2')).toBe('Perplexity-User') // inside /30
  })

  it('returns null for ordinary IPs', () => {
    expect(identifyBot('203.99.205.101')).toBeNull()
    expect(identifyBot('83.86.51.245')).toBeNull()
    expect(identifyBot('2001:1c01:3b04:9a00::1')).toBeNull()
  })

  it('handles malformed input without throwing', () => {
    expect(identifyBot('not-an-ip')).toBeNull()
    expect(identifyBot('999.999.999.999')).toBeNull()
    expect(identifyBot('')).toBeNull()
  })
})
