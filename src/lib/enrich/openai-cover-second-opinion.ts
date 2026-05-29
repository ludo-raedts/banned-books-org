// Visual 2nd-opinion pass over a Gemini-grounded cover candidate.
//
// Gemini hands us {imageUrl, sourcePageUrl, reasoning}; we already verified
// the image actually lives on the page (anti-hallucination), so the remaining
// risk is "right page wrong cover" — e.g. Douban shows several editions and
// Gemini picked a wrong one, or a publisher page has unrelated thumbnails.
//
// We ask gpt-4o-mini with image-vision to look at the actual pixels and say
// whether the picture credibly shows the cover of the named book. Cheap
// (~$0.0001 per image) and orthogonal to Gemini's grounding signal, so a
// hallucinated-but-page-verified candidate will still get caught here.

import OpenAI from 'openai'

let _openai: OpenAI | null = null
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

export type SecondOpinionInput = {
  imageUrl: string
  title: string
  titleNative?: string | null
  author?: string | null
  year?: number | null
}

export type SecondOpinionResult = {
  verdict: 'looks_right' | 'unsure' | 'wrong_book' | 'not_a_cover' | 'unreadable'
  reasoning: string
  inputTokens: number
  outputTokens: number
}

const SYSTEM_PROMPT = `You are a visual verifier for a book-cover database. The user shows you an image and a book's expected metadata. Reply with a single JSON object:
{
  "verdict": "looks_right" | "unsure" | "wrong_book" | "not_a_cover" | "unreadable",
  "reasoning": "one short sentence"
}

Verdict guide:
- "looks_right": image clearly is a book cover, and visible title/author/imagery matches the expected book
- "unsure": image is a cover but you can't tell if it's THIS book (e.g. cover text not visible in image, or generic series cover)
- "wrong_book": image is a cover but for a different book (title/author visible and don't match)
- "not_a_cover": image is something else (author photo, advert, icon, blank)
- "unreadable": couldn't load/see the image content

For Chinese-language books, accept covers where the visible characters match the Chinese title. For translated editions, accept covers where the translated title matches.

Do NOT include any prose outside the JSON.`

export async function openaiCoverSecondOpinion(input: SecondOpinionInput): Promise<SecondOpinionResult> {
  const metadataLines: string[] = []
  metadataLines.push(`Title: ${input.title}`)
  if (input.titleNative && input.titleNative !== input.title) metadataLines.push(`Native title: ${input.titleNative}`)
  if (input.author) metadataLines.push(`Author: ${input.author}`)
  if (input.year) metadataLines.push(`Year: ${input.year}`)

  const response = await openai().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        { type: 'text', text: `Does this image show the cover of the following book?\n\n${metadataLines.join('\n')}` },
        { type: 'image_url', image_url: { url: input.imageUrl, detail: 'low' } },
      ] },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 200,
  })

  const text = response.choices[0]?.message?.content ?? '{}'
  let parsed: { verdict?: unknown; reasoning?: unknown } = {}
  try { parsed = JSON.parse(text) } catch { /* keep defaults */ }

  const verdict: SecondOpinionResult['verdict'] =
    parsed.verdict === 'looks_right' || parsed.verdict === 'unsure' ||
    parsed.verdict === 'wrong_book' || parsed.verdict === 'not_a_cover' ||
    parsed.verdict === 'unreadable' ? parsed.verdict : 'unsure'

  return {
    verdict,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
