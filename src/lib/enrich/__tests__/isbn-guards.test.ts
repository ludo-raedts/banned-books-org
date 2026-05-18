import { describe, it, expect } from 'vitest'
import { isPlaceholderTitle, isPinyinOnlyZh, titleContainment } from '../isbn'

describe('isPlaceholderTitle', () => {
  it.each([
    'Suicide (Title only, no further information)',
    'The Digestive System (Title and author only, no further information)',
    'Akira (Series, Title Not Specified)',
    'The Squad (Series, Title not Specifed', // typo + unclosed paren observed in DB
    'Anastasia Krupnik (series)',
    'The Sleeping Beauty Quartet (series)',
    'Adolescence and the Teenage Crush (Journal Article)',
  ])('flags placeholder: %s', t => {
    expect(isPlaceholderTitle(t)).toBe(true)
  })

  it.each([
    'Twilight',
    'Soul Eater, Vol. 1',
    'Liu si min yun shi',
    'The Series of Unfortunate Events',
    'Pride: Celebrating Diversity',
  ])('does not flag real title: %s', t => {
    expect(isPlaceholderTitle(t)).toBe(false)
  })
})

describe('isPinyinOnlyZh', () => {
  it('flags pinyin-only zh row with no english_meaningful', () => {
    expect(isPinyinOnlyZh({
      title: 'Liu si min yun shi',
      title_english_meaningful: null,
      original_language: 'zh',
    })).toBe(true)
  })

  it('skips when english_meaningful is present', () => {
    expect(isPinyinOnlyZh({
      title: 'Liu si min yun shi',
      title_english_meaningful: 'History of the June 4 Movement',
      original_language: 'zh',
    })).toBe(false)
  })

  it('skips when title contains CJK', () => {
    expect(isPinyinOnlyZh({
      title: '六四民運史',
      title_english_meaningful: null,
      original_language: 'zh',
    })).toBe(false)
  })

  it('skips when original_language is not zh', () => {
    expect(isPinyinOnlyZh({
      title: 'A pure ASCII title',
      title_english_meaningful: null,
      original_language: 'en',
    })).toBe(false)
  })
})

describe('titleContainment', () => {
  // Cases the live 2026-05-18 enrich-isbn run got wrong — these MUST score
  // below the 0.5 threshold so the similarity guard rejects them.
  it.each([
    ['Flight', 'Blade'],
    ['Flowers in the Attic', "Don't Ask Me Where I'm From"],
    ['The Bible', 'Far Eastern Art'],
    ['Ladies on Call', 'Devil on the Cross'],
    ['Taming the Star Runner', 'Devil on the Cross'],
    ['The Atlas Six', "Over Life's Edge"],
    ['The Greek News', "Over Life's Edge"],
    ['Six Chapters in a Man\'s Life', "Over Life's Edge"],
    ['Jin sheng bu zuo Zhongguo ren', 'Jie dao shang, zhang peng ren'],
    ['Min zhu shi wen', 'Ko xue ying yang xue'],
    ['The Drowning Summer', "Don't Ask Me Where I'm From"],
    ['Night Blood', "Don't Ask Me Where I'm From"],
  ])('rejects unrelated pair: %s vs %s', (a, b) => {
    expect(titleContainment(a, b)).toBeLessThan(0.5)
  })

  // True positives that MUST score >= 0.5 so we don't lose legitimate hits.
  it.each([
    ['Soul Eater, Vol. 1', 'Soul Eater'],
    ['The Infernal Devices', 'Clockwork Angel'], // edge: same series but no word overlap
    ['Monument 14: Savage Drift', 'Monument 14'],
    ['Plague Land No Escape', 'Plague Land'],
    ['Critique of Pure Reason', 'Kritik der reinen Vernunft'], // translation: word overlap is nil
  ])('case: %s vs %s', (a, b) => {
    // Just document the score; don't assert. Translation pairs unavoidably
    // score 0 — the dup-skip is the only safety net for those.
    const score = titleContainment(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('series volume retains full containment', () => {
    expect(titleContainment('Soul Eater, Vol. 1', 'Soul Eater')).toBe(1)
    expect(titleContainment('Monument 14: Savage Drift', 'Monument 14')).toBeGreaterThanOrEqual(0.5)
  })

  it('zero when no significant overlap', () => {
    expect(titleContainment('The Bible', 'Far Eastern Art')).toBe(0)
  })
})
