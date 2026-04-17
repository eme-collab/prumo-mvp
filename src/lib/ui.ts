export const ui = {
  page: {
    shell:
      'min-h-[100dvh] bg-neutral-50 px-4 pb-[calc(1rem+var(--safe-area-bottom))] pt-[calc(1rem+var(--safe-area-top))] md:p-8',
    container: 'mx-auto max-w-5xl space-y-4',
    containerNarrow: 'mx-auto max-w-3xl space-y-6',
    containerZen: 'mx-auto max-w-xl space-y-5',
    authShell:
      'min-h-[100dvh] bg-neutral-50 px-4 pb-[calc(1rem+var(--safe-area-bottom))] pt-[calc(1rem+var(--safe-area-top))] md:p-8',
  },

  card: {
    base: 'rounded-2xl border border-neutral-200 bg-white p-5 md:p-6 shadow-sm',
    compact:
      'rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm',
    primary:
      'rounded-2xl border border-sky-200 bg-sky-50 p-5 md:p-6 shadow-sm',
    primaryCompact:
      'rounded-2xl border border-sky-200 bg-sky-50 p-4 md:p-5 shadow-sm',
    zen:
      'rounded-3xl border border-sky-200 bg-white px-5 py-6 shadow-sm md:px-6',
    success:
      'rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm',
    warning:
      'rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm',
    danger:
      'rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm',
    muted:
      'rounded-xl border border-neutral-200 bg-neutral-50 p-4',
    inner:
      'rounded-xl border border-neutral-200 bg-white p-4',
  },

  text: {
    pageTitle: 'text-2xl font-semibold tracking-tight text-neutral-950',
    sectionTitle: 'text-lg font-semibold text-neutral-950',
    cardTitle: 'text-xl font-semibold text-neutral-950',
    label: 'mb-2 block text-sm font-medium text-neutral-900',
    body: 'text-sm text-neutral-700',
    muted: 'text-sm text-neutral-600',
    subtle: 'text-xs text-neutral-500',
    helper: 'text-xs text-neutral-600',
    zenLead: 'text-base font-medium text-neutral-900',
    strong: 'font-medium text-neutral-900',
  },

  button: {
    primary:
      'inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
    secondary:
      'inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
    danger:
      'inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
    neutral:
      'inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
    icon:
      'inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 active:scale-[0.99]',
  },

  badge: {
    neutral:
      'rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700',
    primary:
      'rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700',
    success:
      'rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700',
    warning:
      'rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700',
    danger:
      'rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700',
  },

  input: {
    text: 'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100',
    textarea:
      'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100',
    select:
      'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100',
  },
} as const
