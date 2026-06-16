import type { Metadata } from 'next'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('the-line-we-pretend-not-to-draw')!

export const metadata: Metadata = {
  title: essay.title,
  description: essay.dek,
  openGraph: { title: essay.title, description: essay.dek, type: 'article' },
  alternates: {
    canonical: essay.href,
    types: { 'text/markdown': `${essay.href}.md` },
  },
  robots: essay.draft ? { index: false, follow: true } : undefined,
  other: buildCitationMeta({
    entityType: 'essay',
    title: essay.title,
    url: `https://www.banned-books.org${essay.href}`,
    publicationYear: Number(essay.publishedAt.slice(0, 4)),
    onlineDate: essay.publishedAt,
  }),
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: essay.title,
  description: essay.dek,
  datePublished: essay.publishedAt,
  dateModified: essay.publishedAt,
  image: 'https://www.banned-books.org/opengraph-image',
  author: { '@type': 'Organization', name: 'banned-books.org' },
  publisher: {
    '@type': 'Organization',
    name: 'banned-books.org',
    logo: { '@type': 'ImageObject', url: 'https://www.banned-books.org/brand/compact-bb.png' },
  },
  mainEntityOfPage: `https://www.banned-books.org${essay.href}`,
}

export default function TheLineWePretendNotToDrawPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <p>
          Every school library is already censored. I want to say that plainly
          at the start, because the rest of this only makes sense once you
          accept it.
        </p>

        <p>
          No library buys everything. Someone decides that the picture book
          about anatomy belongs in the fifth-grade room and not the kindergarten
          one. Someone decides the budget buys forty new titles and not four
          hundred. Someone decides the graphic novel with the dismemberment
          scene is fine for a sixteen-year-old and a step too far for an
          eleven-year-old. These are content judgments, made by adults, imposed
          on children who did not vote on them. That is what a curated
          collection is.
        </p>

        <p>
          So when one side of the book-ban debate says{' '}
          <em>
            removing a book isn&apos;t censorship, it&apos;s just age-appropriate
            selection
          </em>
          , they are pointing at something real. And when the other side says{' '}
          <em>
            every collection is already a series of value judgments, so calling
            removal &ldquo;neutral&rdquo; is dishonest
          </em>
          , they are also pointing at something real. Both of these things are
          true at once, which is exactly why the usual framing of this fight is
          useless.
        </p>

        <p>
          The framing goes: you are either for protecting children or for free
          expression. You either trust parents or you trust librarians. You
          either want safe schools or open shelves. I have spent enough time
          around public arguments to recognise the shape of this. It is the same
          shape as <em>security versus privacy</em>,{' '}
          <em>growth versus the environment</em>,{' '}
          <em>you&apos;re with us or against us</em>. The move is always to take
          a question with many possible answers and present it as a coin with
          two sides. It mobilises people. It almost never tells you what to
          actually do on Tuesday morning when a real book is in front of a real
          review committee.
        </p>

        <p>
          I don&apos;t think the interesting question is whether schools make
          choices. They do, they always have, and pretending otherwise is the
          weakest argument the free-expression side makes. The interesting
          question is the one both camps tend to walk past:{' '}
          <strong>
            who gets to make the choice, by what standard, and what happens when
            they get it wrong?
          </strong>
        </p>

        <h2>&ldquo;Parents versus librarians&rdquo; is the wrong fight</h2>

        <p>
          The most popular framing pits parents against professionals. Either
          parents decide what their kids read, or some librarian with an agenda
          decides for them.
        </p>

        <p>
          This collapses the moment you look at how schools have always worked.
          Teachers pick the texts. School boards set the policy. Librarians
          build the collection. Parents raise objections, and in most districts
          there is a formal process for hearing them. None of these actors holds
          a veto over the others. The system is messy and overlapping on
          purpose, because no single one of them should own a child&apos;s
          entire intellectual diet.
        </p>

        <p>
          The honest question was never &ldquo;parents or librarians.&rdquo; It
          is:{' '}
          <em>
            should one parent&apos;s objection remove a book from every other
            family&apos;s children?
          </em>{' '}
          That is a genuinely hard question, and you can feel why people avoid it
          — answering it forces you to admit that &ldquo;parental rights&rdquo;
          and &ldquo;this parent&apos;s preferences for everyone&rdquo; are not
          the same thing. A parent has every right to decide what their own child
          reads. The leap from there to deciding what the other six hundred
          children in the building may read is enormous, and the binary framing
          exists partly to hide that leap.
        </p>

        <p>
          There is a fact that should end the &ldquo;parents versus
          librarians&rdquo; framing entirely, and it comes from the people
          tracking this most closely. The American Library Association reported
          that in 2025, fewer than three percent of book challenges came from
          parents. The overwhelming majority came from organised pressure groups
          and the officials responding to them. So the picture of an anxious
          mother at a school board meeting, while real and sympathetic, is not
          what is driving the numbers. Treating it as the central case is a
          category error — and it is one both sides of the debate keep making.
        </p>

        <h2>
          &ldquo;It&apos;s not really a ban&rdquo; is technically true and
          largely beside the point
        </h2>

        <p>
          The second framing is about the word itself.{' '}
          <em>This isn&apos;t banning,</em> the argument goes,{' '}
          <em>
            the book is still legal, you can buy it on Amazon, the public library
            still has it. Nobody is burning anything.
          </em>
        </p>

        <p>
          Technically correct. A teenager can order almost any title to their
          phone in thirty seconds. No officer is going door to door. If
          &ldquo;ban&rdquo; means &ldquo;made illegal to possess,&rdquo; then
          almost nothing in this debate is a ban.
        </p>

        <p>
          But access is not binary, and the people who lean on this argument know
          it. A book that quietly vanishes from the school shelf is a book most
          students will never find, because the school shelf is where they
          actually browse. A title that suddenly requires a permission slip
          carries a verdict that an openly shelved book does not. Removal changes
          what a young person is likely to encounter, and changing what people
          are likely to encounter is most of what censorship has ever done. The
          Soviet censor rarely needed to burn a book either; quietly not stocking
          it did the work.
        </p>

        <p>
          The reverse overreach is just as lazy. Calling every decision not to
          buy a particular title &ldquo;fascism&rdquo; or &ldquo;book
          burning&rdquo; drains those words of meaning and makes the person
          saying it easy to dismiss. A school library is not the Library of
          Congress. It has a few thousand slots and has to choose. The serious
          task — the one that no slogan helps with — is telling the difference
          between a professional declining to stock a weak book and a campaign
          stripping the shelves of a particular viewpoint. That distinction is
          real, it is sometimes genuinely hard to draw, and no amount of shouting
          &ldquo;censorship&rdquo; or &ldquo;common sense&rdquo; draws it for
          you.
        </p>

        <h2>What happens when the rule is vague</h2>

        <p>
          Iowa shows what the binary produces when it becomes law. Senate File
          496 required schools to remove any book containing a description or
          depiction of a sex act, with no weighing of the work as a whole. The
          drafters presumably imagined they were targeting a narrow band of
          explicit material. What they got was <em>Night</em>, Elie Wiesel&apos;s
          Holocaust memoir, and <em>The Handmaid&apos;s Tale</em>, and{' '}
          <em>1984</em>, and Toni Morrison&apos;s <em>The Bluest Eye</em>, and
          nonfiction like Iris Chang&apos;s <em>The Rape of Nanking</em> — pulled
          because the statute&apos;s wording made no room for the difference
          between a memoir of atrocity and pornography.
        </p>

        <p>
          The courts could not settle it cleanly either. A federal judge blocked
          the law in December 2023, an appeals court let it take effect in August
          2024, and a judge blocked it again — books moving on and off shelves
          while the litigation lurched between rulings. When even the legal
          system cannot hold a stable line, that is not a sign that one side is
          being unreasonable. It is a sign that the rule itself was built to
          erase the context that any sane judgment depends on. A standard that
          cannot distinguish Wiesel from smut is not a standard. It is a
          tripwire.
        </p>

        <p>
          Tennessee took the same path by a different route. Its revised law lets
          a single passage — &ldquo;nudity, sexual conduct, excess violence&rdquo;
          — condemn an entire book, where the older rule had judged the work as a
          whole. Nobody defined &ldquo;excess.&rdquo; So Wilson County removed
          over four hundred titles, including Toni Morrison and, absurdly, a Dr.
          Seuss book. The Tennessee Association of School Librarians counted more
          than eleven hundred removals across the state in the first months. Most
          of those were not the outcome of a parent&apos;s complaint or a board
          vote. Librarians pulled books pre-emptively, because the safest move
          under a vague law with real penalties is to over-remove. That is the
          quiet mechanism worth naming: you do not need to ban a thousand books
          if you can write a rule frightening enough that the librarians ban them
          for you.
        </p>

        <h2>Other countries, other machinery</h2>

        <p>
          It would be easy to read all of this as a story about America, and to
          assume the rest of the world either solved the problem or never had it.
          Neither is true, and the differences are the instructive part.
        </p>

        <p>
          Look at Germany, which has roughly the thing the American debate keeps
          gesturing toward without naming: a process instead of a tripwire. A
          federal body maintains a list of media judged harmful to minors.
          Indexed books stay perfectly legal for adults; what changes is that
          they cannot be sold to minors or advertised to them. The crucial
          detail, for anyone asking <em>who decides and how</em>, is that the
          deciding panel is pluralistic by law — permanent members nominated by
          the federal states, plus members drawn from youth-welfare
          organisations, churches, the medical association and other social
          bodies — and its rulings can be appealed to the administrative courts.
          This is almost the exact inverse of a single school board pulling a
          title by a 4–3 vote in a evening meeting. The decision is slow, it is
          documented, it is reviewable, and it weighs a work rather than mining
          it for one sentence.
        </p>

        <p>
          So Germany wins, and America should copy it? That is where I want to be
          careful, because that conclusion would be its own little false
          dichotomy. The German system has its own failures, and they are real
          ones. German critics have called it outdated and a thin veil of false
          security: in an age where any teenager can find anything online, an
          index of forbidden material arguably advertises the very titles it
          means to bury, while keeping adults — especially parents — in the dark
          about what is on the list at all. A process careful enough to be fair
          is also, often, slow enough to be beside the point. The machinery does
          not abolish the underlying tension between protecting children and
          giving them access. It relocates it. The same hard judgment still has
          to be made, by someone, about some book; Germany has simply built a
          more dignified room for the argument to happen in.
        </p>

        <p>
          And the bonfire is not the only way these things spread. Britain has no
          Iowa-style statute, and most of its challenges still come from
          individuals or small groups rather than organised campaigns. Yet the
          campaigns are arriving anyway: British school librarians in one recent
          study described finding pressure-group propaganda left on their desks
          and being targeted directly by groups whose playbook is American. What
          you learn from the comparison is that the law is not the root of the
          problem. The law is downstream of who organises, and that can be
          exported across an ocean before any legislature lifts a finger.
        </p>

        <h2>The thing the categories miss</h2>

        <p>
          Here is the development that should unsettle everyone who thinks this
          is a fight about explicit novels. In the 2024–2025 school year, PEN
          America found that 29 percent of the unique titles removed from
          American schools were nonfiction — up from 14 percent the year before.
          Biographies. Holocaust memoirs. Histories. Books about grief and health
          and civil rights. Books written not to provoke but to explain.
        </p>

        <p>
          This breaks the comfortable story both sides tell. It is no longer
          &ldquo;lurid fiction versus innocent children.&rdquo; When a third of
          the removed titles are works of fact, the question stops being about
          sexual content and starts being about which parts of the real world
          young people are permitted to learn. That is a different and more
          serious thing, and it does not fit on either side of the coin everyone
          keeps flipping.
        </p>

        <h2>So where is the line</h2>

        <p>
          I have spent this whole piece attacking false either/ors, so I owe you
          something better than &ldquo;it&apos;s complicated.&rdquo; Here is what
          I actually think.
        </p>

        <p>
          The line is not drawn by content. It is drawn by process. A removal is
          legitimate to the degree that it is transparent, applies a consistent
          standard across viewpoints, judges a work as a whole rather than mining
          it for a single sentence, survives an appeal, and lets a parent opt
          their own child out without opting out everyone else&apos;s. A removal
          is illegitimate to the degree that it is opaque, applies one standard
          to one politics and a different standard to another, condemns books by
          the paragraph, and converts one objection into a community-wide
          verdict.
        </p>

        <p>
          Notice that this test says nothing about whether the book is good, or
          whether I would shelve it. That is the point. You can run this test on
          a conservative parent&apos;s objection and a progressive
          librarian&apos;s selection alike, and it will sometimes rule against
          people I agree with. A standard that only ever catches your opponents
          is not a standard; it is a weapon you have not yet been hit with.
        </p>

        <p>
          But I want to resist the next temptation, which is to imagine that the
          right process makes the problem disappear. It does not. Germany has the
          process — pluralistic, reviewable, weighing the whole work — and Germany
          is still arguing about whether the whole apparatus is sensible or just
          a slow and dignified way of doing the wrong thing. A system helps. A
          good system helps a lot. What no system does is dissolve the underlying
          judgment, because somewhere inside even the fairest procedure a human
          being still has to decide that <em>this</em> book, for <em>this</em>{' '}
          age, crosses <em>this</em> line, and reasonable people will keep
          disagreeing about that until the end of time. The value of a good
          process is not that it produces the right answer. It is that it makes
          the answer contestable, visible, and reversible when it is wrong. That
          is a smaller promise than either side of the debate wants. It is also
          the only honest one.
        </p>

        <p>
          Most of what is happening in American schools right now fails this test
          — not because the impulse to protect children is wrong, but because
          vague statutes, pre-emptive removals, and challenges driven by organised
          campaigns rather than the families actually involved are close to the
          textbook definition of arbitrary. The protective instinct is real. The
          machinery built around it is not careful.
        </p>

        <p>
          Pluralism does not let us escape these arguments. Some parents will
          object to things other parents want their kids to read, and there is no
          settlement that makes everyone comfortable. What we can decide is
          whether disagreement runs through a process that the losing side can
          still respect, or whether it gets resolved by whoever holds the school
          board this year. The first is governance. The second is just power,
          dressed up as protection.
        </p>

        <p>
          And the danger in the binary framing is not only that it is annoying.
          It is that it trains us to believe every hard question has exactly two
          answers, one of them ours. Accept that, and the shelves get shorter —
          first in the libraries, and then in the range of things we are still
          able to imagine arguing about at all.
        </p>
      </EssayLayout>
    </>
  )
}
