import type { MarkdownFrontmatter } from '@/lib/markdown-response'

export const frontmatter: MarkdownFrontmatter = {
  title: 'When a banned-books list becomes a warning label',
  url: 'https://www.banned-books.org/essays/when-a-list-becomes-a-warning-label',
  description:
    'AI tools can help schools and campaigners pick books for review. But what happens when a record of past censorship becomes a reason to scrutinise the next book? On Mason City, the new scanners, and the paradox of keeping an open archive of bans.',
  published_at: '2026-11-16',
}

export const body = `# When a banned-books list becomes a warning label

A book does not have to be read before someone tries to remove it. A title on a list, a quotation lifted from another complaint, or a warning from a campaign group can be enough to start the process.

AI makes that process easier to repeat. It can produce an assessment in minutes, complete with passages and the language of a legal standard. The result can look like a considered review even when nobody involved has read the book.

## Mason City

In August 2023, Mason City Community School District in Iowa removed 19 books from its libraries. Iowa had just passed Senate File 496, which requires school library materials to be "age appropriate" and excludes depictions of sex acts. The district said it had no time to read everything before the school year and that the state had given no guidance. So the assistant superintendent put a list of about 50 frequently challenged books into ChatGPT and asked whether each contained a description of a sex act. For 19 the answer was yes. The superintendent cross-checked those against BookLooks.org, a site run by parents that reviews books, and the books were pulled. According to the district, it had never received a parental challenge ([Education Week](https://www.edweek.org/teaching-learning/an-iowa-district-used-ai-to-figure-out-which-books-to-ban/2023/08)).

Reporters then tested the tool themselves. The [Philadelphia Inquirer](https://www.inquirer.com/news/nation-world/friday-night-lights-book-ban-iowa-buzz-bissinger-ai-chatgpt-20230818.html) asked ChatGPT about *Friday Night Lights* and was told no; screenshots it reviewed showed that the chatbot had said yes to the district. [Popular Science](https://www.popsci.com/technology/iowa-chatgpt-book-ban/) also received differing answers when it asked about the 19 titles. After the story ran, the district reversed the removal of *Friday Night Lights*. Its author, Buzz Bissinger, said: "If you're going to ban a book, you might as well read it."

Mason City is not a story about a campaign. It is a story about an institution under legal pressure reaching for the fastest tool. That distinction matters. A book can get into trouble through an individual complaint, through an organised campaign that spreads forms and title lists, or through an institutional audit in which a district screens its own collection, usually because a law or a state agency tells it to. AI can play a part in each, but the actor and the decision are different every time.

## The tools

In 2026, reporting describes a small market. According to [404 Media](https://www.404media.co/blockade-the-right-is-using-ai-content-scanners-to-try-to-supercharge-book-banning/), **BLOCKADE** is an open-source script that sends a book's text to an OpenAI or xAI model and produces a risk report; its prompt defines "educational inappropriateness" as content offensive to conservative values. **Rated Books** hosts AI-assisted reports that check passages against Utah's "harmful to minors" standard, and its founder is reported to have told members that the AI "errs on the side of over-application." **NarraTrue** sells a scan for five dollars that returns page numbers and excerpts. These tools work with book text or selected passages, though how they obtain and assess that material differs.

The most interesting product works with something else. **Bookmarked**, which [K-12 Dive](https://www.k12dive.com/news/as-ai-enters-book-ban-disputes-heres-what-it-means-for-school-districts/816385/) reports is used by at least 150 Texas districts, was described by its CEO in April 2026 as technology that does not search the contents of books. Instead it compared titles with online information: publicity, negative social-media feedback, and lists from other districts, Moms for Liberty and PEN America. He said it only flags titles and that educators decide, and he acknowledged the risk of relying on "hearsay." (The company was reportedly working on a version that would flag books by content.)

Word lists are an older instrument of the same kind. BLOCKADE's scoring starts from a list of roughly 300 words. PEN America's recent research on federal agencies identified more than 900 unique words and phrases, from "bias training" to "feminist", that agencies had banned or flagged for review, used to terminate grants and flag applications and publications. "If your ultimate goal is to suppress the free expression of ideas," PEN America's Jonathan Friedman said, "then controlling language is a good place to start." A list is cheap to apply, and a machine applies it without asking what the word is doing in the sentence.

## The paradox of the list

Here is the mechanism that brings me to this subject. A list that exists to make censorship visible records that a book has been challenged somewhere. Used inside a different process, the same fact becomes a risk signal: this title has been in trouble, so it deserves a look. The more often a book appears on such lists, the more opportunities there are for it to be flagged again. If that leads to another documented removal, the record can grow, making the title more visible to the next district.

*[Diagram: a four-step loop. A book is removed in one district; the removal is documented; elsewhere the record is read as a risk signal; the title is flagged and reviewed, which may end in another removal and a longer record. A side branch notes that the same attention can bring the book more readers, sales and loans.]*

Attention cuts both ways, and that is what makes the paradox harder to resolve. A record that marks a book as targeted also advertises it. When a Tennessee school board removed [*Maus*](https://www.banned-books.org/books/maus) from its eighth-grade curriculum in January 2022, the book climbed to the top of Amazon's bestseller lists within days and a local comic shop handed out free copies to students ([CNBC](https://www.cnbc.com/2022/01/28/maus-amazon-bestseller-after-tennessee-school-ban.html)). Researchers have started to measure the effect. A [Carnegie Mellon working paper](https://www.infodocket.com/2023/10/31/increased-circulation-book-bans-may-have-unintended-consequences-in-increasingly-polarized-united-states/) using library circulation data from 38 states, covering January 2021 to June 2022, found that ban events raised circulation of the banned books, by about 12 percent in states where they were banned and about 11 percent where they were not. The gains were concentrated among lesser-known authors, and books with little social-media visibility saw no effect. A [separate paper](https://business.gmu.edu/news/2025-03/book-bans-are-not-what-they-seem) reports a rise of about 12 percent in circulation for the most-banned titles and a better Amazon sales rank. Both are recent, one is a working paper, and both measure circulation and sales rank, not total readership.

So a list can send some readers toward a book while helping others decide it is risky. The two effects do not cancel out. The reader who gains a bestseller is not the student in the district where the book is no longer on the shelf.

This does not require AI, and it does not require a villain. Florida shows the institutional version. According to [WLRN](https://www.wlrn.org/education/2026-10-22/palm-beach-county-schools-banned-books-libraries), which worked from public documents, Palm Beach County Public Schools had more than 1,830 unique titles under review in an audit in autumn 2026, after a state Department of Education memo urged districts to review their libraries proactively, including books removed elsewhere in the state and frequently challenged authors. If a school held a title on the list, staff were instructed to remove it from student access while it was assessed. WLRN could not establish how many of those titles were actually on school shelves when the review began, and, according to WLRN, parents in the district had not submitted objections to school library books in the previous two years. WLRN did not report that AI was used. The case shows how earlier removals can steer a new audit, regardless of the technology involved.

We build that kind of record. This catalogue holds tens of thousands of ban records, and its [open dataset](https://www.banned-books.org/dataset) is licensed CC BY 4.0 so teachers, journalists and researchers can use it. I cannot say that any tool uses our data, and I have no evidence that one does. But I cannot make the data open for people I approve of and closed for everyone else. A book's presence in an archive of censorship is a reason to read about it. Nothing in the data says it is a reason to remove it, and I should say that on the dataset's own page.

## What the complaints show, and what they do not

The same openness helps in the other direction, because the strongest evidence about who is asking for bans comes from people who read records.

[The Washington Post](https://www.washingtonpost.com/education/2023/12/23/post-reviewed-1000-school-book-challenges-heres-what-we-found/) obtained 1,065 school book challenges from more than 100 districts in 37 states. In its analysis of complaints from the 2021–22 school year, the newspaper reported that 11 people were responsible for 60 percent of the filings it examined. In Florida, the Tampa Bay Times reported in August 2023 ([reprinted here](https://pineapplereport.com/florida-schools-got-hundreds-of-book-complaints-mostly-from-2-people/)) that two people were behind roughly 600 of about 1,100 complaints filed in the year after July 2022, in the 62 districts that responded. [PEN America](https://pen.org/report/banned-usa-growing-movement-to-censor-books-in-schools/) reports that organised groups often supply messaging, forms and instructions that make challenges easier to file, and that books banned in one district are frequently banned in others. In Wisconsin, one parent challenged 444 books, which were temporarily removed pending review. They were later returned to circulation, although some were restricted or moved to different libraries ([National Coalition Against Censorship](https://ncac.org/letters/ncac-recommends-policy-improvements-for-a-wisconsin-school-district-that-received-over-400-book-challenges)).

These findings come from particular datasets and districts. They do not show that most challenges in the United States come from a few people, and they say nothing about how many parents support or oppose a removal. They show who filed the forms that were examined. That matters because a small number of people can generate a large volume of complaints, and each complaint may require a school or district to respond.

## What AI could contribute

Obtaining and reading those records takes time. AI may help researchers work through them, provided that people check the results.

Language models and text-similarity methods are good at comparing large piles of documents. Applied to challenge forms obtained through public-records requests, they could cluster near-identical wording and show which complaints share a template. They could also help researchers follow how groups of titles appear together in several districts. A shared passage or shared title list suggests a common source, though not which one: someone could have used the source and read the book as well, and a record may be dated after the list was already circulating.

Everything depends on people checking the matches. Records are incomplete, not every district keeps or releases forms, and the same person can appear under different spellings while two people share a name. Any claim about concentration should start from aggregated counts, and anything naming individuals needs care about privacy and about the risk of pointing readers at people who have received threats. And when we test the AI scanners themselves, the test should rest on independent human assessment against stated criteria, not on a second model prompt.

## The responsibility of an archive

I will keep the dataset open. I also need to be clear about what it records: a decision made somewhere, at a particular time, under particular circumstances. A book's presence in the archive is not a judgment on whether it belongs in a library.

The record can show us where to start looking. Understanding what happened still takes people willing to read it.
`
