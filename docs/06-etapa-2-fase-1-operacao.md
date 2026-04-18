# Etapa 2 — Fase 1

## Base compartilhada
- `src/lib/pending-state.ts` é a fonte oficial para:
  - pendentes de revisão (`review_status = 'pending'`);
  - contas em aberto (`review_status = 'confirmed'`, `settlement_status = 'open'`, `entry_type in ('sale_due', 'expense_due')`);
  - urgência:
    - `normal`: sem vencimento ou `due_on > hoje`;
    - `due_today`: `due_on = hoje`;
    - `overdue`: `due_on < hoje`.
- A comparação de data usa `America/Sao_Paulo` com data no formato `YYYY-MM-DD`.

## Onde validar
- Painel:
  - `/painel?focus=pending_review`
  - `/painel?focus=open_accounts`
  - `/painel?focus=open_accounts&status=due_today`
  - `/painel?focus=open_accounts&status=overdue`
- Resumo:
  - `/resumo?focus=receivable`
  - `/resumo?focus=payable`

## Eventos persistidos
- Tabela: `app_events`
- Colunas mínimas:
  - `user_id`
  - `session_id`
  - `event_name`
  - `properties`
  - `occurred_at`
- Inserção:
  - cliente via `POST /api/app-events`
  - servidor via `trackAppEventServer`

## Consulta rápida no Supabase
```sql
select event_name, properties, occurred_at
from public.app_events
order by occurred_at desc
limit 50;
```

## Lembrete de escopo
- Esta fase não fecha permissão nativa, throttle final nem cadência final de push.
- O objetivo aqui é garantir estado correto, navegação contextual correta e eventos reais corretos.
