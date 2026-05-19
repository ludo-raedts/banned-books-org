import type { MarkdownFrontmatter } from '@/lib/markdown-response'

export const frontmatter: MarkdownFrontmatter = {
  title: 'Methodology — Why the US dominates this data',
  url: 'https://www.banned-books.org/methodology',
  description:
    'Why the United States accounts for most bans in this catalogue, and what that says about transparency, advocacy, and the limits of available data.',
  published_at: '2025-08-01',
}

export const body = `# Why the United States dominates this data

The US accounts for the overwhelming majority of bans in this catalogue. That is not because American libraries burn the most books — it is because America counts them.

## Transparency creates a paper trail

The United States has two organisations that do something unusual in the world: they systematically count book bans. PEN America publishes an annual Index of School Book Bans, tracking every recorded school-district removal across the country. The American Library Association's Office for Intellectual Freedom has maintained its list of challenged and banned books since the 1990s. These organisations work with local journalists, librarians, and parents to surface and verify individual cases.

The result is a dataset with thousands of entries, each with a date, a location, an institution, and often a reason. No comparable infrastructure exists anywhere else on Earth.

## School bans are structurally different

Most US bans are school bans: a school board in Florida removes [The Hate U Give](https://www.banned-books.org/books/the-hate-u-give) from its libraries, or a Texas district pulls [Gender Queer](https://www.banned-books.org/books/gender-queer) from its shelves. These are local administrative decisions, not national law. The book remains available in bookshops, public libraries in other cities, and online. The restriction is real — children in that district cannot access it through their school — but it is a different kind of restriction than a government banning a book nationwide.

In this catalogue, we document both. A school ban in Florida and a government ban in Iran are both recorded as bans, though we distinguish them by scope ("school" vs. "government") and status ("active" vs. "historical"). The US number is high partly because school-level decisions are included and tracked. Most countries' equivalents are never reported. See our [challenged books page](https://www.banned-books.org/challenged-books) for the full list of school-scope bans and an explanation of challenge vs. ban terminology.

> The United States doesn't ban more books than authoritarian states — it just records the ones it does ban.

## Authoritarian states ban more, document less

Iran, China, North Korea, Saudi Arabia, and Belarus all maintain comprehensive censorship regimes in which vast categories of literature are simply unavailable. Works on religion, sexuality, political dissent, or historical memory are systematically suppressed. But because there is no free press, no civil society watchdog, and no tradition of public reporting on censorship decisions, these bans rarely appear in any accessible database.

When a North Korean novel is deemed counter-revolutionary, no librarian files a report. When an Iranian publisher is told not to print a certain title, there is no press conference. The bans exist, but they are invisible to the data. Our catalogue records only a fraction of what likely occurs in closed societies.

## What counts as a ban?

This catalogue uses a broad definition: any formal removal, import restriction, publication prohibition, or sustained challenge resulting in a book becoming unavailable through an official channel. We include both hard bans (legally prohibited nationwide) and soft bans (withdrawn from a school or library after pressure), as long as there is a documented decision.

We do not include: books that are simply out of print, books a publisher chose not to distribute, or books that are technically available but culturally stigmatised. The restriction must have an institutional actor and a documented decision.

High-profile US titles like [All Boys Aren't Blue](https://www.banned-books.org/books/all-boys-arent-blue) may appear dozens of times because each school-district removal is a separate event. In countries where a single national decision bans a book everywhere, it appears once.

## How to read the numbers

The raw country rankings in this catalogue should be read as a proxy for *documentation quality* as much as for the scale of censorship. A high count for the United States reflects a free and watchful civil society. A low count for Belarus reflects the absence of one.

The catalogue is most useful when looked at comparatively within categories — US school bans versus US library bans, or government bans across European democracies — rather than treating the global total as a straightforward ranking of repression. The country pages include background context on each country's censorship history to help frame the numbers.

## About this catalogue

Data is drawn from PEN America, the American Library Association, Wikipedia, Reporters Without Borders, and Index on Censorship. Every ban entry links to its source. The catalogue is a work in progress — if you know of a ban we've missed, or spot an error, [open an issue on GitHub](https://github.com/ludo-raedts/banned-books-org/issues) or use the contact form on the [About page](https://www.banned-books.org/about). The complete catalogue is also available as a [downloadable dataset](https://www.banned-books.org/dataset) for research and analysis.
`
