import type { MarkdownFrontmatter } from '@/lib/markdown-response'

export const frontmatter: MarkdownFrontmatter = {
  title: 'The forbidden library',
  url: 'https://www.banned-books.org/essays/forbidden-library',
  description:
    'Media artist Evgeniy Afonin turned this catalogue’s open data into a coil of barbed wire whose barbs are banned books, and over 100,000 people watched. On the artist, the five-line caption that says what the data cannot, and why the thinnest barbs are the most telling.',
  published_at: '2026-10-27',
}

export const body = `# The forbidden library

## A library you can only walk around

On 26 October 2026 a media artist named Evgeniy Afonin posted a short video to Instagram. It shows a single coil of barbed wire, slowly turning. Each barb on the wire is one country’s list of forbidden titles, wound with the covers of the books on it, and one turn of the coil carries several countries. Small labels float beside the barbs — a country code, a span of years. It took me a second look to see that the books are the barbs. He called it *forbidden library*, and described it as a data sculpture. Within a day it had more than a hundred thousand likes, and TouchDesigner, the real-time graphics software he built it in, had reposted it to its own followers.

The data under it is ours. The caption credits this catalogue’s open dataset by name, under the CC BY 4.0 licence it is published with, and the book covers to Open Library and the Internet Archive. That is how I found out about it: thousands of people I had never met started typing *banned-books.org* into their phones to see where the books on the wire came from.

[Watch *forbidden library* by Evgeniy Afonin (@netzzy) on Instagram](https://www.instagram.com/reel/De9K8Xfs-Sp/). Data: Banned Books — Open Censorship Core (CC BY 4.0). Covers: Open Library / Internet Archive.

## Who made it

Afonin is not a data journalist who learned some 3D; he is a stage artist who learned to read archives. He started out as a VJ, moved into new media around 2008, and has spent most of his career in theatre and performance — media scenography, interactive light, large-scale shows. Since 2012 he has worked with Yan Kalnberzin as the duo [Curiosity Media Lab](https://curiositylab.media/), and he teaches TouchDesigner to a generation of real-time artists. His video and lighting design for the production *Exhibit/Awakening* won a Golden Mask, Russia’s national theatre award; his 360-degree film *Gagarin. Lieutenant of the Sky* won a Moscow Art Award.

Lately his work has turned to what he calls archival studies: public datasets turned into objects you can look at. A Princeton collection of Soviet and East European propaganda posters, rendered as something closer to a pathogen than a gallery. Russian election-commission results, searched for anomalies. Twenty-five years of the US aviation authority’s wildlife-strike database, plotted strike by strike until an aircraft outline emerges. Rocket alerts in Israel. A Smithsonian parasite collection. The archive is the material; the sculpture is a way of making its shape visible. *forbidden library* is the latest of these, and you can see the others on [his Instagram](https://www.instagram.com/netzzy/).

## Five lines of methodology

The part of the post I keep going back to is not the video. It is the caption. Before any titles, Afonin lists what the sculpture leaves out. It only counts bans by states. It only counts bans someone documented, so it shows the record, not how far censorship actually went. Closed states rarely publish their lists. And then: “no record is not no censorship.”

That is this site’s methodology, written better than I have managed to write it. Our [methodology page](https://www.banned-books.org/methodology) makes the same point at length: the United States does not ban more books than authoritarian states, it just records the ones it bans. And [*What we document*](https://www.banned-books.org/essays/what-we-document) is a whole essay about where the line is drawn and why. Most people who reuse a dataset like this lead with the biggest number. Afonin led with the limits. Then he made a piece in which the limits are the thing you see.

## What the barbs actually show

Filter the catalogue to bans by states — government and customs bans, more or less what his caption describes — and you get roughly 12,600 titles across 117 countries. But the barbs are wildly uneven, and the unevenness is the story:

- **Germany**: about 3,600 titles, almost all from 1933 to 1945 — the Nazi state’s own lists of “harmful and undesirable” literature, compiled and maintained with bureaucratic care.
- **Malaysia**: about 3,100 titles, nearly all from the Home Ministry’s published gazette of prohibited publications.
- **Portugal**: around 900, nearly all of them banned by the Estado Novo dictatorship’s censors.
- **China**, 58. **Iran**, 52. **Saudi Arabia**, 25. **North Korea**, 6. **Turkmenistan**, 1.

Nobody seriously believes Germany is the most censorious country in this dataset or that North Korea forbids six books. The heaviest barbs belong to censors who wrote things down: a regime that lost and left its paperwork behind, a government that prints its bans in an official gazette, a dictatorship whose archives were opened. The thinnest barbs belong to systems where censorship works well enough that it doesn’t need a list — where a book never gets printed, imported, or mentioned in the first place. A complete ban leaves almost no trace in any record.

So a sculpture made of these lists is, without ever saying so, also a picture of paperwork. When you watch the coil turn, the bare wire between the barbs is not freedom. It is the part nobody wrote down.

It is also a picture of ninety years at once. The sculpture shows every list together, so a Nazi index from 1938 sits on the same wire as a Malaysian gazette from last year. Many of these bans were lifted long ago; some died with the state that issued them. Each book’s page here says, where the sources allow, whether a ban is still in force or has become history.

## The books that cross borders

The caption ends with a ranking by number of countries, and the top of it matches ours: [*The Satanic Verses*](https://www.banned-books.org/books/the-satanic-verses) at 22, then [*Lady Chatterley’s Lover*](https://www.banned-books.org/books/lady-chatterleys-lover), [*1984*](https://www.banned-books.org/books/1984), [*Lolita*](https://www.banned-books.org/books/lolita), [*Tropic of Cancer*](https://www.banned-books.org/books/tropic-of-cancer), [*Animal Farm*](https://www.banned-books.org/books/animal-farm). Sex, blasphemy, and two books about the state lying to you. These are the titles that travel because they were famous before anyone banned them, and every ban made them more famous. The same caveat applies here too: a famous book gets its bans written down, reported, and catalogued. A pamphlet seized at a border in 1974 usually does not.

That is the strange double nature of the piece. It is a monument to the books that were forbidden, and it is equally a monument to the people who did the forbidding — the clerks, censors, and customs officers whose lists are the only reason any of this can be counted at all.

## What an open dataset is for

When I put the censorship core of this catalogue on [Zenodo under CC BY 4.0](https://www.banned-books.org/dataset), I pictured researchers, librarians, maybe a journalist on deadline. I did not picture a sculpture. That is exactly why the data is open: you do not know in advance what someone will build with it, and the best uses are the ones nobody planned. Afonin credited it properly, kept its limitations in the frame, and showed more than a hundred thousand people the shape of a thing most of them had never thought about.

If you build something with the data — a sculpture, a paper, a lesson, a map — I would like to see it. And if you came here from the video: the barbs are made of real books. Every one of them has a page on this site, with the countries that banned it and the sources that say so. Start with the [countries](https://www.banned-books.org/countries), or with the book that hangs on the most barbs of all, [*The Satanic Verses*](https://www.banned-books.org/books/the-satanic-verses).
`
