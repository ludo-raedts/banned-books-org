import { frontmatter, body } from '@/lib/markdown-pages/why-not-amazon'
import {
  buildMarkdownDocument,
  markdownResponse,
} from '@/lib/markdown-response'

export const revalidate = 3600

export function GET() {
  return markdownResponse(buildMarkdownDocument(frontmatter, body))
}
