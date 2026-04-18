export const GLOBAL_TOAST_QUERY_KEYS = {
  kind: 'toast',
  undo: 'toastUndo',
  entryId: 'toastEntryId',
} as const

export type GlobalToastKind =
  | 'entry_confirmed'
  | 'entry_discarded'
  | 'entry_saved'
  | 'entry_updated'
  | 'entry_deleted'
  | 'first_capture_confirmed'
  | 'receipt_confirmed'
  | 'payment_confirmed'
  | 'manual_confirmed'
  | 'manual_pending'
  | 'entry_reopened'
  | 'settlement_reopened'

export type GlobalToastUndo =
  | 'undo_review_confirm'
  | 'undo_review_discard'
  | 'undo_settlement_confirm'

type GlobalToastDefinition = {
  message: string
  undoLabel?: string
  tone: 'info' | 'success' | 'warning'
}

const TOAST_DEFINITIONS: Record<GlobalToastKind, GlobalToastDefinition> = {
  entry_confirmed: {
    message: 'Pronto. Lançamento confirmado.',
    undoLabel: 'Desfazer',
    tone: 'success',
  },
  entry_discarded: {
    message: 'Tudo certo. Lançamento descartado.',
    undoLabel: 'Desfazer',
    tone: 'warning',
  },
  entry_saved: {
    message: 'Salvo para revisar depois.',
    tone: 'info',
  },
  entry_updated: {
    message: 'Movimentação atualizada.',
    tone: 'success',
  },
  entry_deleted: {
    message: 'Movimentação excluída.',
    tone: 'warning',
  },
  first_capture_confirmed: {
    message: 'Pronto. Ficou salvo.',
    tone: 'success',
  },
  receipt_confirmed: {
    message: 'Pronto. Recebimento confirmado.',
    undoLabel: 'Desfazer',
    tone: 'success',
  },
  payment_confirmed: {
    message: 'Pronto. Pagamento confirmado.',
    undoLabel: 'Desfazer',
    tone: 'success',
  },
  manual_confirmed: {
    message: 'Pronto. Lançamento confirmado.',
    tone: 'success',
  },
  manual_pending: {
    message: 'Salvo para revisar.',
    tone: 'info',
  },
  entry_reopened: {
    message: 'Lançamento voltou para pendentes.',
    tone: 'info',
  },
  settlement_reopened: {
    message: 'Conta voltou para em aberto.',
    tone: 'info',
  },
}

function isGlobalToastKind(value: string | null): value is GlobalToastKind {
  return value !== null && value in TOAST_DEFINITIONS
}

function isGlobalToastUndo(value: string | null): value is GlobalToastUndo {
  return (
    value === 'undo_review_confirm' ||
    value === 'undo_review_discard' ||
    value === 'undo_settlement_confirm'
  )
}

export function buildToastHref(
  href: string,
  options: {
    kind: GlobalToastKind
    undo?: GlobalToastUndo
    entryId?: string
  }
) {
  const [pathname, rawSearch = ''] = href.split('?')
  const searchParams = new URLSearchParams(rawSearch)

  searchParams.set(GLOBAL_TOAST_QUERY_KEYS.kind, options.kind)

  if (options.undo) {
    searchParams.set(GLOBAL_TOAST_QUERY_KEYS.undo, options.undo)
  } else {
    searchParams.delete(GLOBAL_TOAST_QUERY_KEYS.undo)
  }

  if (options.entryId) {
    searchParams.set(GLOBAL_TOAST_QUERY_KEYS.entryId, options.entryId)
  } else {
    searchParams.delete(GLOBAL_TOAST_QUERY_KEYS.entryId)
  }

  const nextSearch = searchParams.toString()
  return nextSearch ? `${pathname}?${nextSearch}` : pathname
}

export function removeToastQueryParams(searchParams: URLSearchParams) {
  searchParams.delete(GLOBAL_TOAST_QUERY_KEYS.kind)
  searchParams.delete(GLOBAL_TOAST_QUERY_KEYS.undo)
  searchParams.delete(GLOBAL_TOAST_QUERY_KEYS.entryId)
  return searchParams
}

export function getGlobalToastFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const kind = searchParams.get(GLOBAL_TOAST_QUERY_KEYS.kind)

  if (!isGlobalToastKind(kind)) {
    return null
  }

  const undo = searchParams.get(GLOBAL_TOAST_QUERY_KEYS.undo)
  const entryId = searchParams.get(GLOBAL_TOAST_QUERY_KEYS.entryId)
  const definition = TOAST_DEFINITIONS[kind]
  const resolvedUndo =
    definition.undoLabel && entryId && isGlobalToastUndo(undo) ? undo : null

  return {
    kind,
    message: definition.message,
    tone: definition.tone,
    entryId,
    undo: resolvedUndo,
    undoLabel: resolvedUndo ? definition.undoLabel : null,
  }
}
