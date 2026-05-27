#!/usr/bin/env python3
"""Parse the APM 'Biblioteca de Libros Prohibidos' PDF into structured JSON.

Approach:
  - Catalog pages: PDF page indexes 10..24 (printed pages 19..47)
  - Each page has 4 columns; split by page.width / 4
  - Per column: group chars by y-position into lines
  - Classify each line by font:
      BOLD     → new author record
      ITALIC   → title under current author
      neither  → skip (page numbers, letter headers, etc.)
  - State carries across columns: a column may start with an italic line
    that belongs to the last bold-author of the previous column (Lenin's
    long title list overflows columns this way).

Output: data/apm-biblioteca-batch1.json
Schema (one entry per author):
    {
        "author":  "Surname, Firstname" or "Editorial Anteo" or "Anónimo",
        "titles":  ["Title 1", "Title 2", ...],
        "page":    19    # printed page where the author first appears
    }
"""
import pdfplumber
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

PDF = '/tmp/apm/biblioteca.pdf'
OUT = Path('/Users/ludoraedts/projects/banned-books-org/data/apm-biblioteca-batch1.json')

CATALOG_PAGES = list(range(10, 25))   # 0-indexed PDF pages; printed 19..47
COLS = 4
LINE_Y_TOLERANCE = 3                  # chars within ±3 pt are same line
HEADER_Y_MIN = 50                     # ignore everything above this (page-numbers)

def font_kind(line_chars):
    """Return 'BOLD' / 'ITAL' / 'other' based on majority font of line.

    APM uses:
      - Authors: MyriadPro-BoldSemiCn (ends in 'SemiCn', no 'It')
      - Titles:  MyriadPro-SemiboldSemiCnIt (ends in 'It')
    So italic check must look for 'It' suffix; bold check must EXCLUDE 'It' suffix.
    """
    def is_ital(c):
        fn = c.get('fontname') or ''
        return fn.endswith('It')
    def is_bold(c):
        fn = c.get('fontname') or ''
        # Bold/Semibold but NOT italic
        return ('Bold' in fn or 'Semibold' in fn) and not fn.endswith('It')

    bold = sum(1 for c in line_chars if is_bold(c))
    ital = sum(1 for c in line_chars if is_ital(c))
    n = len(line_chars)
    if n == 0:
        return 'other'
    if ital / n > 0.5:
        return 'ITAL'
    if bold / n > 0.5:
        return 'BOLD'
    return 'other'

def normalise_text(s: str) -> str:
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'\s+', ' ', s).strip()
    # Spanish smart-quote normalisation
    s = s.replace('"', '"').replace('"', '"').replace("'", "'").replace("'", "'")
    return s

def extract_lines(page, x0, x1):
    """Cluster chars in [x0,x1] strip by y-position, return [(y, text, kind)]."""
    chars = [c for c in page.chars if x0 <= c['x0'] < x1 and c['top'] >= HEADER_Y_MIN]
    lines = defaultdict(list)
    for c in chars:
        # Snap y to nearest LINE_Y_TOLERANCE bucket
        bucket = round(c['top'] / LINE_Y_TOLERANCE) * LINE_Y_TOLERANCE
        lines[bucket].append(c)
    out = []
    for y, line_chars in sorted(lines.items()):
        text = ''.join(c['text'] for c in sorted(line_chars, key=lambda c: c['x0']))
        text = normalise_text(text)
        if not text:
            continue
        kind = font_kind(line_chars)
        out.append((y, text, kind))
    return out

def is_letter_header(text: str, kind: str) -> bool:
    """Single uppercase letter A-Z or A. used as section divider."""
    return kind != 'ITAL' and len(text) <= 3 and re.match(r'^[A-ZÑ]\.?$', text) is not None

def merge_continuation_titles(lines):
    """A title that wraps onto a second line keeps the same y-bucket diff
    of one line-height. We don't have to merge — the next line in italic
    that's not directly below a bold simply appends to the last title."""
    # Actually for our purposes, multi-line italic blocks ARE multiple
    # titles — the publication uses one line per title in italic block.
    # If wrapping occurs, it's already a single title that pdfplumber
    # extracted as one line via the line-grouping above.
    return lines

def parse():
    authors_out = []    # list of dict { author, titles, page }
    current = None       # current author dict being built

    with pdfplumber.open(PDF) as pdf:
        for pageno in CATALOG_PAGES:
            page = pdf.pages[pageno]
            printed_page = pageno + 1
            W = page.width
            col_w = W / COLS
            for col_idx in range(COLS):
                x0 = col_idx * col_w
                x1 = (col_idx + 1) * col_w
                lines = extract_lines(page, x0, x1)
                lines = merge_continuation_titles(lines)
                for y, text, kind in lines:
                    if is_letter_header(text, kind):
                        continue
                    if kind == 'BOLD':
                        # Start new author. But: a long author name (with
                        # co-authors using ' – ' separator) can wrap onto two
                        # bold lines. If the previous line was BOLD and we're
                        # still inside the same record (no titles yet), append.
                        if current is not None and not current['titles']:
                            current['author'] = current['author'] + ' ' + text
                        else:
                            if current is not None:
                                authors_out.append(current)
                            current = {'author': text, 'titles': [], 'page': printed_page}
                    elif kind == 'ITAL':
                        if current is None:
                            # ITAL with no author yet — orphan; skip (rare)
                            continue
                        # Continuation? Lowercase start = wrap of previous title
                        if current['titles'] and text and text[0].islower():
                            current['titles'][-1] = current['titles'][-1] + ' ' + text
                        else:
                            current['titles'].append(text)
                    # 'other' kind skipped

        # Final author
        if current is not None:
            authors_out.append(current)

    return authors_out

def main():
    authors = parse()
    total_titles = sum(len(a['titles']) for a in authors)
    print(f'Parsed {len(authors)} authors, {total_titles} titles total')

    # Sanity: any authors with 0 titles?
    no_titles = [a for a in authors if not a['titles']]
    if no_titles:
        print(f'\n⚠ {len(no_titles)} authors have 0 titles:')
        for a in no_titles[:10]:
            print(f'  page {a["page"]}: "{a["author"]}"')

    # Sample: print first 5 and last 3
    print('\n── First 5 authors ──')
    for a in authors[:5]:
        print(f'  [{a["page"]}] {a["author"]}')
        for t in a['titles']:
            print(f'        · {t}')

    print('\n── Last 3 authors ──')
    for a in authors[-3:]:
        print(f'  [{a["page"]}] {a["author"]}')
        for t in a['titles']:
            print(f'        · {t}')

    # Distribution: how many titles per author
    from collections import Counter
    title_dist = Counter(len(a['titles']) for a in authors)
    print('\n── Titles-per-author distribution ──')
    for n in sorted(title_dist.keys())[:15]:
        print(f'  {n} titles: {title_dist[n]} authors')

    # Write JSON
    OUT.write_text(json.dumps(authors, ensure_ascii=False, indent=2))
    print(f'\nWrote {OUT}')

if __name__ == '__main__':
    main()
