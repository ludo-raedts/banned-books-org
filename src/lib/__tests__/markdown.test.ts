import { describe, expect, it } from 'vitest'
import { renderContentBlockHtml } from '../markdown'

describe('renderContentBlockHtml', () => {
  it('renders headings, paragraphs, lists, links, emphasis', () => {
    const md = [
      '## Heading',
      '',
      'A paragraph with **strong** and *em* and a [link](https://example.com).',
      '',
      '- one',
      '- two',
    ].join('\n')

    const html = renderContentBlockHtml(md)
    expect(html).toContain('<h2>')
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<a')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('strips raw HTML, images, and tables', () => {
    const md = '<script>alert(1)</script>\n\n![img](http://x/y.png)\n\n| a | b |\n|---|---|\n| 1 | 2 |'
    const html = renderContentBlockHtml(md)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<table')
  })

  it('rejects unsafe link schemes', () => {
    const md = '[click](javascript:alert(1))'
    const html = renderContentBlockHtml(md)
    // sanitize-html removes the disallowed-scheme href; the <a> may remain
    // but without an href that points anywhere dangerous.
    expect(html).not.toContain('javascript:')
  })

  it('returns empty string for empty / whitespace input', () => {
    expect(renderContentBlockHtml('')).toBe('')
    expect(renderContentBlockHtml('   \n\n')).toBe('')
  })
})
