import Link from 'next/link'
import AppShellMenu from '@/components/app-shell-menu'
import type { NotificationUsefulItemsState } from '@/lib/notification-readiness'
import { ui } from '@/lib/ui'

export default function AppShellHeader({
  userId,
  hasCompletedFirstCapture,
  isZenMode,
  usefulItems,
  actionHref,
  actionLabel,
}: {
  userId: string
  hasCompletedFirstCapture: boolean
  isZenMode: boolean
  usefulItems: NotificationUsefulItemsState
  actionHref?: string | null
  actionLabel?: string | null
}) {
  return (
    <div className={ui.card.base}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Prumo
          </p>
          <p className={`mt-1 ${ui.text.muted}`}>
            Registre, revise e acompanhe sem complicar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {actionHref && actionLabel && (
            <Link href={actionHref} className={ui.button.neutral}>
              {actionLabel}
            </Link>
          )}

          <AppShellMenu
            userId={userId}
            hasCompletedFirstCapture={hasCompletedFirstCapture}
            isZenMode={isZenMode}
            usefulItems={usefulItems}
          />
        </div>
      </div>
    </div>
  )
}
