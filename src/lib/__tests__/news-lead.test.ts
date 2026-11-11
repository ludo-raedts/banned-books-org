import { describe, expect, it } from 'vitest'
import { newsLead } from '../news-lead'

describe('newsLead', () => {
  it('drops the attribution the card already shows, keeping a full sentence', () => {
    expect(
      newsLead(
        'Libraries in Moscow and Russia’s Arkhangelsk and Leningrad regions are removing Alexander Pelevin’s novel “Pokrov-17” from open shelves, according to a report by TV host Ksenia Sobchak’s Telegram channel. More follows.',
      ),
    ).toBe('Libraries in Moscow and Russia’s Arkhangelsk and Leningrad regions are removing Alexander Pelevin’s novel “Pokrov-17” from open shelves.')
  })

  it('cuts a long sentence at a trailing clause, never mid-phrase', () => {
    expect(
      newsLead(
        'PEN America submitted written testimony to Florida Commissioner of Education Henry Mack, calling for public school stakeholders to receive clear explanations and a role in decisions about which books students can access.',
      ),
    ).toBe('PEN America submitted written testimony to Florida Commissioner of Education Henry Mack.')
    expect(
      newsLead(
        'Elgin Community College’s library commemorated Banned Books Week, an annual event focused on books that have been challenged or removed from libraries and schools.',
      ),
    ).toBe('Elgin Community College’s library commemorated Banned Books Week.')
  })

  it('keeps list commas and sentences it cannot shorten safely', () => {
    const list = 'Libraries in Moscow, Arkhangelsk, Leningrad and Tula are removing the novel from open shelves after a request from a regional official this week.'
    expect(newsLead(list)).toBe(list)
    const long =
      'PEN International will open its Expressions of Freedom online auction on 9 November 2026 to raise funds for defending freedom of expression and supporting writers at risk worldwide.'
    expect(newsLead(long)).toBe(long)
  })

  it('never ends in an ellipsis', () => {
    expect(newsLead('x'.repeat(30) + ' ' + 'word '.repeat(80) + '.')).not.toMatch(/…$/)
  })
})
