// LLM-backed generator for book-club discussion questions.
//
// Two flavours:
//
//   • generateDiscussionQuestions — literary questions about THIS specific
//     book. Used by every reading-club track. Accepts an optional `audience`
//     hint so the young-readers track can produce questions that work for a
//     book published for younger readers (which adults may still be reading).
//
//   • generateBanDiscussionQuestions — censorship-focused questions. Only
//     used by the young-readers track today, where it sits alongside the
//     literary set so a reading group can talk about both the book itself
//     and why people tried to keep it from children. STUB prompt — the
//     definitive editorial template is delivered separately.
//
// Provider auto-detection: prefers Claude Opus 4.7 (best quality on this
// task) when ANTHROPIC_API_KEY is set, falls back to OpenAI gpt-4o when only
// OPENAI_API_KEY is set. Caller can force a provider via the second argument.
//
// Output contract: an array of strings, with the LAST item being a deeper
// "big question" inspired by the book. Caller persists the array as-is into
// the right jsonb column on the track's reading-club table.

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export type Provider = 'claude' | 'openai'

const CLAUDE_MODEL = 'claude-opus-4-7'
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'

// The editorial prompt. Three placeholders: [TITLE], [AUTHOR], [AUDIENCE].
// The audience block is only inserted when the caller passes one (used by
// the young-readers track to tell the model the book was published for kids
// or teens — without forcing every question to be about that fact).
const PROMPT_TEMPLATE = `Generate 5–10 thoughtful, varied, and emotionally intelligent book club discussion questions for the following book:

[TITLE] by [AUTHOR][AUDIENCE]

Context:
This book has been banned, challenged, censored, or restricted somewhere in the world. However, the discussion questions should not constantly focus on censorship unless that theme is naturally important to the book itself.

Your task:
First identify the dominant themes, emotional tensions, literary style, historical context, and controversies surrounding the book. Then generate discussion questions that feel specifically written for THIS book — not generic reading group questions.

Guidelines:
- The questions should feel nuanced, conversational, and suitable for an engaged adult reading group.
- Avoid generic school-style questions and avoid trivia.
- Avoid repetitive phrasing and avoid making every question sound structurally identical.
- Do not overuse "Do you agree?" or yes/no constructions.
- Vary the tone and rhythm of the questions naturally.
- Some questions can be direct and challenging; others can be reflective or interpretive.

Mix different kinds of questions, including:
- literary analysis
- symbolism and themes
- character psychology and motivation
- emotional impact
- moral ambiguity
- social or political relevance
- reader discomfort or conflicting interpretations
- historical context
- power structures, identity, freedom, religion, sexuality, class, race, propaganda, trauma, or control — where relevant

Modern parallels:
- Include 1–2 questions that connect the book to contemporary society, culture, technology, politics, media, identity, surveillance, freedom of expression, or public debate — but ONLY if those parallels feel natural for the book.
- Do not force modern comparisons into books where they do not fit.

Censorship:
- If relevant, include a question exploring why the book may have been controversial, banned, or challenged.
- Do not make censorship the focus of every question.

Tone:
- Intelligent but accessible.
- Thoughtful rather than academic.
- Curious rather than judgmental.
- Comfortable with ambiguity and tension.

Important:
Different books require different styles of questions.
A dystopian novel, queer coming-of-age story, political satire, erotic classic, religious critique, or war novel should each produce clearly different kinds of discussions.

End with one final "big question" — a deeper philosophical, ethical, or societal question inspired by the book that could lead to a long discussion.

Output format:
Return ONLY a single JSON object with this exact shape, with no surrounding prose, no Markdown, and no code fences:

{"questions": ["question 1", "question 2", "...", "the final big question"]}

The array must contain 5–10 strings total. The last string is the "big question".`

// STUB — editorial team will deliver the final prompt as a follow-up task.
// Kept deliberately short so smoke tests can exercise the full pipeline
// (route → lib → provider → DB write-back) without committing to wording
// the editorial team hasn't signed off on.
const BAN_PROMPT_TEMPLATE = `Generate 5–10 discussion questions about the censorship history of the following book — focused on WHY people tried to keep this book out of children's hands, what changed in the surrounding culture that made it controversial, and what a reader today might think about that history.

[TITLE] by [AUTHOR][AUDIENCE]

Guidelines:
- Each question must be about the censorship event, not the book's literary themes.
- Mix specific (why this book in this place at this time) with general (what does this say about who gets to decide what children read).
- Avoid yes/no questions and avoid generic "what do you think?" phrasings.
- One question should be counter-factual: if you had written this book, would you have done anything differently?
- End with a "big question" about children's literature and censorship more broadly.

Output format:
Return ONLY a single JSON object with this exact shape, with no surrounding prose, no Markdown, and no code fences:

{"questions": ["question 1", "question 2", "...", "the final big question"]}

The array must contain 5–10 strings total. The last string is the "big question".`

function audienceClause(audience: string | null | undefined): string {
  const a = audience?.trim()
  if (!a) return ''
  return ` — published as ${a}`
}

export function detectProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return 'claude'
  if (process.env.OPENAI_API_KEY) return 'openai'
  throw new Error(
    'No LLM credentials found — set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY in .env.local.',
  )
}

export async function generateDiscussionQuestions(
  book: { title: string; author: string; audience?: string | null },
  options?: { provider?: Provider; anthropic?: Anthropic; openai?: OpenAI },
): Promise<string[]> {
  return callQuestionsPrompt(PROMPT_TEMPLATE, book, options)
}

export async function generateBanDiscussionQuestions(
  book: { title: string; author: string; audience?: string | null },
  options?: { provider?: Provider; anthropic?: Anthropic; openai?: OpenAI },
): Promise<string[]> {
  return callQuestionsPrompt(BAN_PROMPT_TEMPLATE, book, options)
}

async function callQuestionsPrompt(
  template: string,
  book: { title: string; author: string; audience?: string | null },
  options?: { provider?: Provider; anthropic?: Anthropic; openai?: OpenAI },
): Promise<string[]> {
  const provider = options?.provider ?? detectProvider()
  const prompt = template
    .replaceAll('[TITLE]', book.title || 'Untitled')
    .replaceAll('[AUTHOR]', book.author || 'Unknown')
    .replaceAll('[AUDIENCE]', audienceClause(book.audience))

  const answer = provider === 'claude'
    ? await callClaude(prompt, options?.anthropic)
    : await callOpenAI(prompt, options?.openai)

  const parsed = parseJsonObject(answer)
  if (!parsed || !Array.isArray((parsed as { questions?: unknown }).questions)) {
    throw new Error(`Unexpected response shape: ${answer.slice(0, 200)}…`)
  }
  const questions = (parsed as { questions: unknown[] }).questions
    .filter((q): q is string => typeof q === 'string')
    .map(q => q.trim())
    .filter(Boolean)
  if (questions.length === 0) {
    throw new Error('Empty questions array in response')
  }
  return questions
}

// ── Provider implementations ────────────────────────────────────────────────

async function callClaude(prompt: string, client?: Anthropic): Promise<string> {
  const c = client ?? new Anthropic()
  const response = await c.messages.create({
    model: CLAUDE_MODEL,
    // 16K headroom: adaptive thinking can spend a lot of tokens before the
    // final JSON answer; the JSON itself is small but we don't want to clip
    // the thinking that produces it.
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: prompt }],
  })
  // Pull the visible text block (skip thinking / tool-use blocks). With
  // adaptive thinking on Opus 4.7, content is a discriminated union — narrow
  // by .type before reading .text.
  let text = ''
  for (const block of response.content) {
    if (block.type === 'text') text += block.text
  }
  if (!text.trim()) throw new Error('Claude returned no text content')
  return text
}

async function callOpenAI(prompt: string, client?: OpenAI): Promise<string> {
  const c = client ?? new OpenAI()
  // Use response_format json_object — gpt-4o reliably returns valid JSON when
  // asked, and the prompt already specifies the exact shape we want.
  const response = await c.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a thoughtful book club facilitator. Return only valid JSON in the exact shape the user specifies.',
      },
      { role: 'user', content: prompt },
    ],
  })
  const text = response.choices[0]?.message?.content ?? ''
  if (!text.trim()) throw new Error('OpenAI returned no content')
  return text
}

// Best-effort JSON extraction. Handles the model occasionally wrapping JSON
// in a code fence despite instructions, or prefixing a stray sentence.
function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  // Strip triple-backtick fences if present.
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const candidate = fenceMatch ? fenceMatch[1] : trimmed
  // Find the outermost {...} substring — robust to leading/trailing prose.
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}
