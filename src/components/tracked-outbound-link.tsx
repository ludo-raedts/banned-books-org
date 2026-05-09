'use client'

import { track } from '@vercel/analytics'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type AllowedPropertyValues = string | number | boolean | null | undefined

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> & {
  eventName: string
  eventProperties?: Record<string, AllowedPropertyValues>
  children: ReactNode
}

export default function TrackedOutboundLink({
  eventName,
  eventProperties,
  children,
  ...rest
}: Props) {
  return (
    <a
      {...rest}
      onClick={() => {
        track(eventName, eventProperties)
      }}
    >
      {children}
    </a>
  )
}
