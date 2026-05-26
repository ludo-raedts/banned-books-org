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

// Young-readers book-set prompt. Used when an `audience` is passed to
// generateDiscussionQuestions — i.e. only by the young-readers track today.
// The defining constraint: the questions must work for THREE reading
// situations at once (young reader alone, adult reading with a child,
// adult re-reading a book they were given as a child). That triangulation
// is what keeps the questions out of school-comprehension territory and
// out of academic-book-club territory.
const YOUNG_READERS_BOOK_TEMPLATE = `Generate 5–10 thoughtful discussion questions about the following book, written for a reading group that may include young readers, the adults reading with them, and the adults who once read the book themselves.

[TITLE] by [AUTHOR][AUDIENCE]

Context:
The book was published for readers under 18. It has been challenged, restricted, or banned somewhere in the world — but these discussion questions are about the book itself, not its censorship history. A companion set of "About the ban" questions covers that.

Audience for these questions:
The questions need to work in three reading situations at once:
- A young reader reading the book alone, thinking about what they read.
- An adult reading the book with a child, talking through it together.
- An adult re-reading a book they were given (or loved) as a child.
The same question should land for all three. Don't write a question that only makes sense for an eight-year-old, and don't write one that only makes sense for a thirty-eight-year-old.

Guidelines:
- Each question must feel specific to THIS book — its characters, the language the author chose, the choices the story turns on. Avoid generic "what was your favourite part" filler.
- Use accessible language. No literary-theory vocabulary ("interrogate", "deconstruct", "subvert"). No "themes of" framing — just say what you mean in plain words.
- Avoid yes/no constructions. Avoid "do you agree?" framings. Mix open questions with prompts that ask the reader to commit to a view.
- Vary the modes: emotional, ethical, structural, imaginative, compare-the-book-to-the-reader's-life.
- The book may have moments that are sad, scary, or morally complex. Don't tiptoe — write questions that take those moments seriously and invite the reader to take them seriously too.
- Avoid school-style comprehension questions ("what is the climax of the story", "describe the setting"). This is a reading group, not a test.
- Use the audience hint after the author's name as background context for tone, not as a topic. Don't write questions about the audience category itself.

Modern parallels:
- Include up to one question that connects the book to something a reader might recognise in the world today — but only if the parallel actually fits the specific book. Force nothing.

End with one "big question" — a single deeper question about the book's central idea, written in plain language a young reader could answer in their own way and an adult could spend an hour on.

Output format:
Return ONLY a single JSON object with this exact shape, with no surrounding prose, no Markdown, and no code fences:

{"questions": ["question 1", "question 2", "...", "the final big question"]}

The array must contain 5–10 strings total. The last string is the "big question".`

// Ban-set prompt — only used by the young-readers track. Questions focus on
// the specific censorship event around THIS book: who tried to remove it,
// when, where, on what grounds, and what the stated reason vs. underlying
// motive looks like in retrospect. Same three-audience constraint as the
// book-set: works for a young reader, an adult reading with one, and an
// adult re-reader.
const BAN_PROMPT_TEMPLATE = `Generate 5–10 discussion questions about the censorship history of the following book, written for a reading group that may include young readers, the adults reading with them, and the adults who once read the book themselves.

[TITLE] by [AUTHOR][AUDIENCE]

Context:
The book was written and published for readers under 18. Adults — sometimes parents, sometimes schools, sometimes governments — have tried to keep it from those readers. These questions are about WHY: what was being protected, who decided, and what gets lost when a book disappears from a library shelf.

Audience for these questions:
The questions need to work in three reading situations at once:
- A young reader who is themselves the kind of reader the censors said they were trying to protect, asked to think about what that meant.
- An adult reading the book with a child, who has to decide what to say about the censorship history.
- An adult re-reading a book they read as a child, wondering in retrospect what was at stake.
The same question should land for all three.

Guidelines:
- Each question must be grounded in the specific censorship history of THIS book — who tried to remove it, when, where, on what grounds. Use what you know about the actual ban record; don't invent specifics, but don't shy away from the documented record either.
- Include one question that holds two things side by side: what the people who challenged the book SAID they were doing (their stated reason) and what they might actually have been protecting (their underlying motive). Treat the gap between those as the interesting thing — don't tell the reader what to conclude.
- Include one counter-factual: if the book were being written today, would the author change anything? Would the same scene still be the reason to challenge it?
- Include one question that asks what the young reader the censor said they were protecting would actually have lost if the book had been removed from their school or library.
- Don't frame the censors as cartoon villains or the writer as a saint. The questions should make the reader do the moral work, not deliver verdicts.
- Use accessible language. No "intellectual freedom discourse", no "marginalised voices", no academic vocabulary. Plain words.
- Avoid yes/no constructions and "do you agree" framings. Mix open questions with ones that ask the reader to commit to a view.

End with one "big question" — a deeper question about banning children's books in general, written in plain language a young reader could answer in their own way and an adult could spend an hour on.

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
  // Audience presence is the implicit signal that this book belongs to the
  // young-readers track: only that track passes a non-null audience today.
  // Switch to the audience-aware template so the questions work for both the
  // young reader and the adult reading with them, not for an academic
  // book-club voice that misses the actual audience.
  const template = book.audience?.trim() ? YOUNG_READERS_BOOK_TEMPLATE : PROMPT_TEMPLATE
  return callQuestionsPrompt(template, book, options)
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
