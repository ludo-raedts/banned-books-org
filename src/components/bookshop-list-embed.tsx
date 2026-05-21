'use client'

/**
 * Embeds a Bookshop.org curated list (list or carousel variant) as an
 * iframe. Lazy-mounted via IntersectionObserver so the external
 * bookshop.org subframe stays off the critical path.
 *
 * We construct the iframe URL ourselves (the structure is the same as
 * what bookshop.org/widgets.js builds internally — we inspected the
 * script). This sidesteps the widget script entirely, avoiding its
 * DOMContentLoaded-bound init handler that would never fire for a
 * dynamically-injected script.
 *
 * URL shapes (verified from widgets.js source):
 *   list:     https://bookshop.org/widgets/list/{slug}
 *   carousel: https://bookshop.org/widgets/carousel/{slug}?affiliate_id={id}&show_title={bool}
 *
 * Attribution for list embeds runs through the list owner's affiliate
 * account on Bookshop's side (the list was created under our 123844
 * account), so no affiliate-id query param is required on the list
 * variant. The carousel variant accepts one for symmetry.
 */

import { useEffect, useRef, useState } from 'react'
import { BOOKSHOP_AFFILIATE_ID } from '@/lib/bookshop-lists'

type Variant = 'list' | 'carousel'

type Props = {
  slug: string
  /**
   * 'list' matches the snippet Bookshop hands you in their UI and is
   * the safe default. Use 'carousel' for horizontal-strip layouts.
   */
  variant?: Variant
  affiliateId?: string
  /** Show the bookshop-side list title above the cards (carousel only). */
  showTitle?: boolean
  className?: string
}

const FRAME_HEIGHT = 440

function buildIframeUrl(slug: string, variant: Variant, affiliateId: string, showTitle: boolean): string {
  if (variant === 'list') {
    return `https://bookshop.org/widgets/list/${encodeURIComponent(slug)}`
  }
  const params = new URLSearchParams()
  params.set('affiliate_id', affiliateId)
  params.set('show_title', String(showTitle))
  return `https://bookshop.org/widgets/carousel/${encodeURIComponent(slug)}?${params}`
}

export function BookshopListEmbed({
  slug,
  variant = 'list',
  affiliateId = BOOKSHOP_AFFILIATE_ID,
  showTitle = true,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (!ref.current || shouldLoad) return
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }
    const obs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true)
            obs.disconnect()
            return
          }
        }
      },
      { rootMargin: '400px 0px' },
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [shouldLoad])

  const iframeSrc = buildIframeUrl(slug, variant, affiliateId, showTitle)

  return (
    <div
      ref={ref}
      className={className}
      style={{ minHeight: FRAME_HEIGHT }}
      aria-label="Bookshop.org curated list"
    >
      {shouldLoad && (
        <iframe
          src={iframeSrc}
          title="Bookshop.org curated list"
          width="100%"
          height={FRAME_HEIGHT}
          scrolling="no"
          style={{ border: 'none', display: 'block' }}
          loading="lazy"
        />
      )}
    </div>
  )
}
