import Eyebrow from './Eyebrow'

type Props = {
  tone?: 'white' | 'cream'
  eyebrow?: string
  id?: string
  children: React.ReactNode
}

export default function SectionShell({
  tone = 'white',
  eyebrow,
  id,
  children,
}: Props) {
  const toneClasses =
    tone === 'cream'
      ? 'bg-cream border-y border-cream-border'
      : 'bg-white'
  return (
    <section
      id={id}
      className={`py-10 md:py-12 px-6 md:px-9 ${toneClasses}`}
    >
      <div className="max-w-5xl mx-auto">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {children}
      </div>
    </section>
  )
}
