# Initials-vs-fullname author duplicates — audit

_Gegenereerd 2026-05-27 door `scripts/_audit_initials_vs_fullname_authors.ts`._

Vindt paren waar één author-rij "V. Achternaam" gebruikt en een andere "Voornaam Achternaam" — dubbelingen die het bio-anchored `merge-name-variant-authors.ts` mist (omdat geen of verschillende bios bestaan).

- **HIGH (0)** — score ≥ 70: aanbevolen merge
- **MEDIUM (4)** — score 40-69: handmatige review
- **LOW (0)** — score 20-39: onwaarschijnlijk, gevlagd voor compleetheid

## Hoe op te lossen

1. **HIGH** — voer per paar uit: `keep = fullRow.id`, `drop = initRow.id`. Hergebruik het patroon uit [`scripts/merge-name-variant-authors.ts`](../scripts/merge-name-variant-authors.ts): verplaats `book_authors`-links van drop → keep, verwijder dan de drop-rij. Voor losse paren is een one-shot script (à la [`scripts/merge-credential-suffix-authors.ts`](../scripts/merge-credential-suffix-authors.ts)) het snelst.
2. **MEDIUM** — check eerst Wikipedia / OpenLibrary. Belangrijkste twijfel-signalen die hier landen: geen overlappende boeken, geen geboorte-/sterfjaar, of bio-jaccard tussen 0.2-0.6. Vaak gaat het om twee echte personen met dezelfde achternaam (bijv. "C. Williams" als afkorting van Charles ≠ "Catherine Williams"). Pak op naar HIGH zodra je extra bewijs vindt; anders skip.
3. **LOW** — meestal echt verschillende personen. Alleen mergen als handmatige bron-check expliciet bevestigt.

Aanbevolen keep-regel: de rij met de **volledige voornaam** wint, ook als de initials-rij meer boeken heeft (display-naam is leesbaarder; links verhuizen mee). Tiebreaker: laagste `id`.

## MEDIUM — handmatige review

### 1. score=50 · MEDIUM

- **KEEP** id=2107 · `Rachelle Lee Smith` · slug=`rachelle-lee-smith`
- **DROP** id=6886 · `Ronald L. Smith` · slug=`ronald-l-smith`
  - United States
  - bio: _Ronald L. Smith is a children's book author. He is the author of Hoodoo (2015), The Mesmerist (2017), Black Panther: The…_
- signalen: alignment=EXACT (+50)

### 2. score=50 · MEDIUM

- **KEEP** id=8050 · `William McElwee Miller` · slug=`william-mcelwee-miller`
- **DROP** id=7855 · `William M. Miller` · slug=`william-m-miller`
- signalen: alignment=EXACT (+50)

### 3. score=42 · MEDIUM

- **KEEP** id=3313 · `Christine Lynn Herman` · slug=`christine-lynn-herman`
  - bio: _The Devouring Gray is a 2019 young adult novel written by Christine Lynn Herman.…_
- **DROP** id=3473 · `C.L. Herman` · slug=`c-l-herman`
  - b.1819 · d.1891 · United States
  - bio: _Herman Melville (born Melvill; August 1, 1819 – September 28, 1891) was an American writer of the American Renaissance p…_
- signalen: alignment=EXACT (+50) · bio jaccard=0.01 weak (-8)

### 4. score=42 · MEDIUM

- **KEEP** id=1210 · `Hilary W. Poole` · slug=`hilary-w-poole`
  - bio: _Three Days of the Condor is a 1975 American spy thriller film directed by Sydney Pollack and starring Robert Redford, Fa…_
- **DROP** id=7155 · `H. W. Poole` · slug=`h-w-poole`
  - b.1821 · d.1855
  - bio: _William Poole (July 24, 1821 – March 8, 1855), also known as Bill the Butcher, was the leader of the Washington Street G…_
- signalen: alignment=EXACT (+50) · bio jaccard=0.10 weak (-8)
