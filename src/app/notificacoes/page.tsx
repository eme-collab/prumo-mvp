import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppShellHeader from '@/components/app-shell-header'
import NotificationPreferencesCard from '@/components/notification-preferences-card'
import { getNotificationUsefulItemsState } from '@/lib/notification-menu-state'
import { createClient } from '@/lib/supabase/server'
import { ui } from '@/lib/ui'
import { resolveFirstCaptureState } from '@/lib/user-app-state'

function buildNotificationSummaryLines(usefulItems: {
  pendingReviewCount: number
  receivableDueTodayCount: number
  receivableOverdueCount: number
  payableDueTodayCount: number
  payableOverdueCount: number
}) {
  const lines: string[] = []

  if (usefulItems.pendingReviewCount > 0) {
    lines.push(
      `${usefulItems.pendingReviewCount} lançamento${
        usefulItems.pendingReviewCount > 1 ? 's' : ''
      } pendente${usefulItems.pendingReviewCount > 1 ? 's' : ''} para revisar`
    )
  }

  const receivableCount =
    usefulItems.receivableDueTodayCount + usefulItems.receivableOverdueCount

  if (receivableCount > 0) {
    lines.push(
      `${receivableCount} conta${
        receivableCount > 1 ? 's' : ''
      } a receber para acompanhar`
    )
  }

  const payableCount =
    usefulItems.payableDueTodayCount + usefulItems.payableOverdueCount

  if (payableCount > 0) {
    lines.push(
      `${payableCount} conta${
        payableCount > 1 ? 's' : ''
      } a pagar para acompanhar`
    )
  }

  return lines
}

export default async function NotificacoesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const firstCaptureState = await resolveFirstCaptureState({
    supabase,
    userId: user.id,
    cookieStore,
  })
  const usefulItems = await getNotificationUsefulItemsState(supabase, user.id)
  const summaryLines = buildNotificationSummaryLines(usefulItems)

  return (
    <main className={ui.page.shell}>
      <div className={ui.page.containerNarrow}>
        <AppShellHeader
          userId={user.id}
          hasCompletedFirstCapture={firstCaptureState.hasCompletedFirstCapture}
          isZenMode={!firstCaptureState.hasCompletedFirstCapture}
          usefulItems={usefulItems}
          actionHref="/painel"
          actionLabel="Painel"
        />

        <div className={ui.card.base}>
          <h1 className={ui.text.pageTitle}>Notificações e lembretes</h1>
          <p className={`mt-2 ${ui.text.muted}`}>
            Ative só o que ajuda de verdade no dia a dia: pendentes para revisar,
            cobranças para acompanhar e contas para não esquecer.
          </p>

          {summaryLines.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {summaryLines.map((line) => (
                <span key={line} className={ui.badge.warning}>
                  {line}
                </span>
              ))}
            </div>
          )}
        </div>

        <NotificationPreferencesCard
          usefulItems={usefulItems}
          hasCompletedFirstCapture={firstCaptureState.hasCompletedFirstCapture}
        />
      </div>
    </main>
  )
}
