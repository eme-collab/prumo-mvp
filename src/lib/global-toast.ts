export const GLOBAL_TOAST_QUERY_KEYS = {
  kind: 'toast',
  undo: 'toastUndo',
  entryId: 'toastEntryId',
} as const

export type GlobalToastKind =
  | 'entry_confirmed'
  | 'entry_discarded'
  | 'entry_saved'
  | 'receipt_confirmed'
  | 'payment_confirmed'
  | 'manual_confirmed'
  | 'manual_pending'
  | 'entry_reopened'

export type GlobalToastUndo = 'undo_review_confirm' | 'undo_review_discard'

type GlobalToastDefinition = {
  message: string
  undoLabel?: string
}

const TOAST_DEFINITIONS: Record<GlobalToastKind, GlobalToastDefinition> = {
  entry_confirmed: {
    message: 'Lançamento confirmado.',
    undoLabel: 'Desfazer',
  },
  entry_discarded: {
    message: 'Lançamento descartado.',
    undoLabel: 'Desfazer',
  },
  entry_saved: {
    message: 'Alterações salvas.',
  },
  receipt_confirmed: {
    message: 'Recebimento confirmado.',
  },
  payment_confirmed: {
    message: 'Pagamento confirmado.',
  },
  manual_confirmed: {
    message: 'Lançamento confirmado.',
  },
  manual_pending: {
    message: 'Lançamento salvo para revisar.',
  },
  entry_reopened: {
    message: 'Lançamento voltou para pendentes.',
  },
}

function isGlobalToastKind(value: string | null): value is GlobalToastKind {
  return value !== null && value in TOAST_DEFINITIONS
}

function isGlobalToastUndo(value: string | null): value is GlobalToastUndo {
  return value === 'undo_review_confirm' || value === 'undo_review_discard'
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
    entryId,
    undo: resolvedUndo,
    undoLabel: resolvedUndo ? definition.undoLabel : null,
  }
}
