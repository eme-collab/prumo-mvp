'use client'

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useState } from 'react'
import type { AppEventName, AppEventProperties } from '@/lib/app-events'
import { trackAppEventClient } from '@/lib/app-events-client'
import { ui } from '@/lib/ui'
import InfoButton from './info-button'

type DashboardCollapsibleCardProps = {
  id?: string
  title: string
  description: string
  badge: ReactNode
  badgeClassName: string
  infoLabel: string
  infoContent: string
  className: string
  defaultExpanded?: boolean
  highlighted?: boolean
  trackOpenEvent?: {
    eventName: AppEventName
    properties?: AppEventProperties
  }
  children: ReactNode
}

const INTERACTIVE_SELECTOR =
  'a,button,input,textarea,select,label,audio,[role="dialog"],[data-no-card-toggle="true"]'

function targetIsInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR)
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 text-neutral-400 transition ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 5 5 5-5" />
    </svg>
  )
}

export default function DashboardCollapsibleCard({
  id,
  title,
  description,
  badge,
  badgeClassName,
  infoLabel,
  infoContent,
  className,
  defaultExpanded = false,
  highlighted = false,
  trackOpenEvent,
  children,
}: DashboardCollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  function toggle() {
    setIsExpanded((current) => {
      const nextState = !current

      if (nextState && trackOpenEvent) {
        void trackAppEventClient(trackOpenEvent)
      }

      return nextState
    })
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (targetIsInteractive(event.target)) {
      return
    }

    toggle()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`${className} cursor-pointer ${
        highlighted ? 'ring-2 ring-sky-300 ring-offset-2 ring-offset-neutral-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={ui.text.sectionTitle}>{title}</h2>
            <ChevronIcon expanded={isExpanded} />
          </div>
          <p className="mt-1 text-sm text-neutral-600">{description}</p>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <span className={badgeClassName}>{badge}</span>
          <InfoButton label={infoLabel} content={infoContent} />
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-black/5 pt-4">{children}</div>
      )}
    </div>
  )
}
