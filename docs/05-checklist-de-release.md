# Prumo — Checklist de Release

## Objetivo deste documento
Este checklist existe para validar se uma versão do Prumo está segura o suficiente para teste ou publicação.

A ideia não é burocratizar. A ideia é impedir que uma mudança simples quebre o fluxo principal do produto.

---

# 1. Checklist rápido antes de qualquer release

## Código e versionamento
- [ ] Estou em uma branch correta ou já trouxe a mudança para a branch desejada
- [ ] O código relevante foi revisado
- [ ] O commit tem um escopo claro
- [ ] Não há mudanças soltas sem entendimento
- [ ] O histórico local está organizado o suficiente para reverter se necessário

## Build e execução
- [ ] O projeto roda localmente
- [ ] Não há erro crítico de build
- [ ] Não há erro crítico de lint, se aplicável
- [ ] Não há erro óbvio de import, rota ou dependência

---

# 2. Fluxo principal do produto
Este é o núcleo do Prumo. Se esta parte falhar, a release não está pronta.

## Login
- [ ] O usuário consegue entrar no app
- [ ] O redirecionamento após login funciona
- [ ] O estado autenticado está consistente
- [ ] O bloco de instalação pré-login só aparece quando houver condição técnica real de instalação e o app não estiver instalado

## Gravação
- [ ] O botão de gravação funciona
- [ ] O botão de parar gravação funciona
- [ ] O feedback visual da gravação está claro
- [ ] O áudio é gerado corretamente

## Upload
- [ ] O áudio é enviado sem erro
- [ ] O sistema trata erro de upload de forma compreensível
- [ ] O usuário entende que o item está sendo processado

## Processamento
- [ ] O áudio segue para processamento
- [ ] A transcrição/interpretação não trava o fluxo
- [ ] O sistema gera um item revisável quando possível

## Revisão
- [ ] O lançamento pendente aparece para revisão
- [ ] As informações principais estão visíveis
- [ ] O usuário consegue entender o que foi interpretado

## Confirmação
- [ ] O usuário consegue confirmar o lançamento
- [ ] O lançamento confirmado sai do fluxo de pendentes
- [ ] O sistema leva ao próximo pendente, se existir
- [ ] O primeiro lançamento confirmado por voz encerra o Modo Zen e libera o painel normal
- [ ] O feedback “Pronto. Ficou salvo.” aparece sem entrar em loop

## Descarte
- [ ] O usuário consegue descartar um lançamento
- [ ] O descarte funciona mesmo em casos ruins de interpretação, quando aplicável
- [ ] O sistema leva ao próximo pendente, se existir

---

# 3. Fluxos de borda
Esses fluxos não podem ser ignorados porque afetam confiança.

## Transcrição ruim ou vazia
- [ ] O sistema não quebra quando a transcrição vem ruim
- [ ] O usuário ainda consegue decidir o que fazer
- [ ] O descarte funciona normalmente

## Interpretação incompleta
- [ ] O sistema não apresenta comportamento incoerente
- [ ] O usuário consegue revisar sem confusão grave

## Fim da fila de pendentes
- [ ] Quando não há mais pendentes, o sistema informa isso com clareza
- [ ] O usuário não fica preso em tela inconsistente
- [ ] O redirecionamento final faz sentido

## Modo Zen
- [ ] Conta com flag ausente ou `false` entra no Modo Zen
- [ ] Durante o Modo Zen, Resumo, Manual, cards secundários e card de instalação do painel não aparecem
- [ ] Apenas gravar/processar sem confirmar não libera o painel normal
- [ ] Descartar um lançamento não libera o painel normal
- [ ] Fluxo manual não encerra o Modo Zen
- [ ] Quick confirm elegível usa a mesma regra oficial de desbloqueio do fluxo canônico
- [ ] O feedback de primeiro desbloqueio aparece uma vez e não reaparece em refresh posterior
- [ ] Com `PRUMO_ENABLE_FIRST_CAPTURE_DEBUG=true` fora de produção, o bloco interno de validação aparece apenas no painel
- [ ] No bloco de validação, `Flag remota false` + `Limpar cookie local` reproduzem o estado equivalente a linha ausente para o gate
- [ ] Se `SUPABASE_SERVICE_ROLE_KEY` estiver disponível localmente, `Remover linha remota` realmente apaga `user_app_state` do usuário atual
- [ ] Com `Ativar falha remota`, a confirmação por voz continua funcionando, o painel normal permanece liberado na mesma sessão e o cookie local aparece
- [ ] Depois de `Desativar falha remota` e recarregar o painel, o retry remoto estabiliza a flag e limpa o cookie local

---

# 4. Histórico e resumo
Esses pontos validam se o Prumo está entregando utilidade após o registro.

## Histórico
- [ ] Lançamentos confirmados aparecem corretamente
- [ ] Os dados principais fazem sentido
- [ ] Não há duplicidade óbvia

## Resumo financeiro
- [ ] O total de entradas confirmadas faz sentido
- [ ] O total de despesas confirmadas faz sentido
- [ ] Os valores a receber fazem sentido
- [ ] Os valores a pagar fazem sentido
- [ ] O saldo do período faz sentido

---

# 5. Experiência do usuário
Uma release não deve piorar a simplicidade do app.

- [ ] A interface continua simples
- [ ] O fluxo principal continua rápido
- [ ] Não surgiram campos desnecessários
- [ ] Não surgiram cliques desnecessários
- [ ] As mensagens estão claras
- [ ] O produto continua com foco em voz + revisão rápida

---

# 6. Checklist técnico mínimo
- [ ] Variáveis de ambiente necessárias estão configuradas
- [ ] Rotas principais estão funcionando
- [ ] Storage está acessível
- [ ] Autenticação está funcionando
- [ ] Não há erro crítico de integração com serviços essenciais
- [ ] Não há quebra evidente entre ambiente local e deploy

---

# 7. Etapa 2 — validação operacional de notificações
Este bloco fecha a validação humana da Etapa 2 sem exigir dashboard novo.

## Ativação e readiness
- [ ] Login e Modo Zen não disparam prompt nativo de notificação
- [ ] Fora do Zen, com valor percebido e item útil, o microbloco aparece no painel
- [ ] Clicar em “Agora não” respeita a recusa por 7 dias no mesmo navegador
- [ ] Com permissão negada no navegador, a UI não finge que ainda pode ativar push
- [ ] Com permissão concedida mas sem subscription válida, o app tenta resubscribe antes de marcar como efetivamente ativo

## Teste ponta a ponta
- [ ] Há `NEXT_PUBLIC_VAPID_PUBLIC_KEY` configurada e subscription válida no navegador
- [ ] O botão “Enviar notificação de teste” só aparece quando o usuário está realmente apto a receber
- [ ] A notificação de teste chega de verdade
- [ ] Ao abrir a notificação de teste, o app volta com contexto válido e registra uma única abertura

## Lembretes úteis N1 / N2 / N3
- [ ] Pendência de revisão só entra em lembrete após 15 minutos
- [ ] Pendência agregada dispara no máximo 1 vez por dia por usuário
- [ ] Recebível due today só entra na janela 08:00–10:00 America/Sao_Paulo
- [ ] Recebível overdue só volta no dia seguinte e depois no máximo 1 vez a cada 3 dias, com limite de 3 envios por item
- [ ] Pagável segue a mesma regra de due today / overdue / limite por item
- [ ] Item resolvido sai do painel, do resumo, da elegibilidade e deixa de gerar novos pushes

## Deep link e contexto
- [ ] `pending_review` abre revisão direta quando houver um único item, ou painel com `focus=pending_review` quando agregado
- [ ] `receivable_*` abre `/liquidar/[id]`
- [ ] `payable_*` abre `/liquidar/[id]`
- [ ] Abrir a notificação não deixa o app em tela genérica sem foco útil

## Consultas SQL mínimas para validar a etapa
Rodar no SQL Editor do Supabase ou equivalente, ajustando o intervalo conforme a janela do teste.

### Eventos principais do funil
```sql
select
  event_name,
  count(*) as total
from public.app_events
where occurred_at >= now() - interval '7 days'
  and event_name in (
    'login_completed',
    'first_record_started',
    'first_record_completed',
    'first_record_confirmed',
    'record_started',
    'record_completed',
    'record_confirmed',
    'notification_opened'
  )
group by event_name
order by event_name;
```

### Quantos voltaram por notificação
```sql
select count(*) as notification_opens
from public.app_events
where occurred_at >= now() - interval '7 days'
  and event_name = 'notification_opened';
```

### Quem voltou a usar o microfone repetidamente
```sql
select
  user_id,
  count(*) as total_record_started
from public.app_events
where occurred_at >= now() - interval '7 days'
  and event_name in ('first_record_started', 'record_started')
group by user_id
having count(*) > 1
order by total_record_started desc;
```

### Amostra de entregas e aberturas de notificação
```sql
select
  notification_type,
  delivery_scope,
  delivery_key,
  sent_at,
  opened_at,
  item_type,
  item_id
from public.notification_deliveries
where sent_at >= now() - interval '7 days'
order by sent_at desc
limit 50;
```

### Itens ainda abertos que continuam elegíveis
```sql
select
  entry_type,
  settlement_status,
  due_on,
  review_status,
  count(*) as total
from public.financial_entries
where review_status = 'confirmed'
  and settlement_status = 'open'
  and due_on is not null
group by entry_type, settlement_status, due_on, review_status
order by due_on asc;
```

---

# 8. Checklist final de decisão
Responder honestamente:

- [ ] Eu testei o fluxo principal inteiro
- [ ] Eu testei pelo menos um caso feliz e um caso com problema
- [ ] Eu entendo exatamente o que esta release altera
- [ ] Se der problema, eu sei qual commit ou branch reverter
- [ ] Esta versão deixa o Prumo melhor sem aumentar complexidade desnecessária

---

# 9. Regra final de release
Se qualquer item crítico do fluxo principal falhar, a release deve ser tratada como não pronta.

## Regra-mãe
No Prumo, estabilidade e clareza valem mais do que pressa.
