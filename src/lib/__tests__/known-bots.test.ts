import { describe, expect, it } from 'vitest'
import { identifyBotByUA } from '../known-bots'

describe('identifyBotByUA', () => {
  const cases: Array<[string, string | null]> = [
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36', 'Bingbot'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0 Safari/537.36 (compatible; meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))', 'Meta crawler'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ShapBot/0.1.0', 'ShapBot'],
    ['Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', 'SemrushBot'],
    ['LinkupBot/1.0 (LinkupBot for web indexing; https://linkup.so/bot; bot@linkup.so)', 'LinkupBot'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Googlebot'],
    ['Mozilla/5.0 (compatible; SomeNewBot/2.0; +https://example.com)', 'SomeNewBot'],
    // Real browsers must not match (Edge's "Edg", DuckDuckGo's "Ddg", Safari…).
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0', null],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15 Ddg/27.0', null],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1', null],
  ]
  for (const [ua, name] of cases) {
    it(`${name ?? 'not a bot'}: ${ua.slice(0, 50)}`, () => expect(identifyBotByUA(ua)).toBe(name))
  }
  it('handles empty input', () => {
    expect(identifyBotByUA(null)).toBeNull()
    expect(identifyBotByUA('')).toBeNull()
  })
})
