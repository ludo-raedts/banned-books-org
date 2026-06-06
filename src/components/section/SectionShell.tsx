import Eyebrow from './Eyebrow'

type Props = {
  tone?: 'white' | 'cream'
  eyebrow?: string
  id?: string
  // Joins this section to a same-tone section directly above it: drops the top
  // border + tightens the top padding so two stacked cream bands read as one
  // continuous zone instead of a broken alternation seam.
  seamless?: boolean
  children: React.ReactNode
}

export default function SectionShell({
  tone = 'white',
  eyebrow,
  id,
  seamless = false,
  children,
}: Props) {
  const toneClasses =
    tone === 'cream'
      ? `bg-cream ${seamless ? 'border-b' : 'border-y'} border-cream-border`
      : 'bg-white'
  // Seamless sections lose their top padding so the band above flows straight
  // into them (the section above keeps its bottom padding as the breathing room).
  const padClasses = seamless ? 'pt-0 pb-10 md:pb-12' : 'py-10 md:py-12'
  return (
    <section
      id={id}
      className={`${padClasses} px-6 md:px-9 ${toneClasses}`}
    >
      <div className="max-w-5xl mx-auto">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {children}
      </div>
    </section>
  )
}
