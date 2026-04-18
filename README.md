# Prumo

Aplicativo de gestão financeira simples para pequenos empreendedores, com foco em **lançamentos por voz**.

O Prumo foi criado para reduzir o atrito do registro financeiro no dia a dia. Em vez de depender de planilhas complexas ou digitação extensa, o usuário grava um áudio curto, o sistema interpreta a fala e gera um lançamento revisável para confirmação.

---

## Visão geral

O objetivo do Prumo é permitir que o empreendedor registre fatos financeiros do negócio com rapidez, clareza e baixa fricção.

### Proposta central
- gravar um áudio curto;
- transformar essa fala em um lançamento financeiro;
- revisar o que o sistema interpretou;
- confirmar ou descartar;
- acompanhar os dados no histórico e no resumo financeiro.

### Público-alvo
Pequenos empreendedores brasileiros, especialmente profissionais que:
- trabalham na operação do próprio negócio;
- têm pouco tempo;
- precisam de praticidade no celular;
- querem registrar vendas e despesas sem burocracia.

---

## Status do projeto

Este projeto está em fase de **MVP funcional com refinamentos em andamento**.

O fluxo principal já foi validado em nível de MVP:
- login;
- gravação de áudio;
- upload;
- processamento;
- geração de lançamento pendente;
- revisão;
- confirmação;
- histórico;
- resumo financeiro.

O foco atual é melhorar:
- estabilidade;
- clareza da interface;
- confiança na revisão;
- consistência do fluxo principal.

### Etapa 1 do Modo Zen
- contas com `has_completed_first_capture = false`, ausente ou sem linha em `user_app_state` entram no Modo Zen;
- o Modo Zen mostra apenas a ação principal de gravar e esconde resumo, entrada manual, cards secundários e card de instalação do painel;
- o desbloqueio oficial acontece apenas depois da confirmação final de um lançamento com `source = 'voice'`;
- confirmações manuais, descarte, revisão sem confirmar e gravação sem confirmação não encerram o Modo Zen;
- se a persistência remota da flag falhar, um cookie de sessão mantém o painel normal liberado na mesma sessão e o painel tenta persistir novamente depois.

### Fase 1 de PWA app-like
- metadata e branding reais do Prumo;
- manifest via App Router;
- ícones para instalação e tela inicial;
- abertura em modo standalone quando instalado;
- card de instalação no painel;
- shell mobile com safe areas e viewport mais estável.

Nesta fase, o objetivo é deixar o Prumo com cara de aplicativo no celular sem alterar o fluxo principal de login, gravação, revisão, confirmação e resumo.

### Fase 2 de consolidação do PWA
- service worker com cache mínimo e seguro do app shell;
- estratégia de atualização silenciosa do app instalado;
- fallback offline seguro sem expor dados autenticados em cache;
- consistência melhor em modo standalone;
- UX de autenticação mais simples e consistente no app instalado.

### Fase 3 de reengajamento com notificações push
- base completa de push notifications no PWA;
- subscriptions salvas por usuário;
- preferências simples para pendentes, contas a pagar e contas a receber;
- push de teste para validar o dispositivo;
- endpoint server-side para envio de lembretes reais;
- rotina preparada para agendamento externo simples.

---

## Fluxo principal do produto

O fluxo principal do Prumo é:

1. o usuário grava um áudio curto;
2. o áudio é enviado para processamento;
3. o sistema interpreta a fala;
4. um lançamento pendente é gerado;
5. o usuário revisa o conteúdo;
6. o usuário confirma ou descarta;
7. o lançamento passa a compor o histórico e o resumo financeiro.

### Exemplo de uso
> “Fiz uma instalação para o João. Ele me pagou 250 reais hoje e ficou de acertar o restante daqui 15 dias.”

O sistema deve tentar interpretar:
- tipo do lançamento;
- valor;
- situação de recebido ou a receber;
- descrição;
- prazo, quando houver.

---

## Escopo do MVP

Neste estágio, o Prumo trabalha com 4 tipos principais de lançamento:

- **venda recebida**
- **venda a receber**
- **despesa paga**
- **despesa a pagar**

O MVP foi mantido enxuto de propósito para validar a proposta central com simplicidade.

### Fora do escopo neste momento
- integrações bancárias;
- relatórios avançados;
- automações complexas;
- parametrizações excessivas;
- múltiplos módulos de gestão.

---

## Princípios do produto

Toda evolução do Prumo deve respeitar estes princípios:

- **simplicidade extrema**
- **baixa fricção**
- **clareza**
- **utilidade prática**
- **mobile-first**

Regra-mãe: se houver dúvida entre uma solução mais sofisticada e uma solução mais simples, a solução mais simples deve vencer, desde que preserve utilidade real para o pequeno empreendedor.

---

## Stack atual

O MVP foi construído com:

- **Next.js**
- **Supabase**
- **Vercel**

### PWA
O Prumo agora inclui a base da experiência PWA app-like:
- `src/app/manifest.ts` para o Web App Manifest;
- `public/icons/` para os ícones de instalação;
- `public/sw.js` como base segura de app shell;
- componente de instalação exibido no painel quando o app ainda não está instalado.

Para testar a instalação localmente, prefira HTTPS no desenvolvimento (`next dev --experimental-https`) e valide em um celular real.

### Checklist manual minimo da Etapa 1
1. Conta com `has_completed_first_capture = false` ou ausente entra no Modo Zen.
2. Gravar ou abrir revisão sem confirmar não libera o painel normal.
3. Descartar um pendente por voz não libera o painel normal.
4. Confirmar por voz via revisão canônica libera o painel normal e mostra o feedback uma vez.
5. Confirmar por voz via quick confirm libera o painel normal com o mesmo feedback.
6. Confirmar ou salvar manualmente não libera o Modo Zen.
7. Conta com `has_completed_first_capture = true` já entra no painel normal.

#### Modo de validacao assistida da Etapa 1
- ative apenas fora de producao com `PRUMO_ENABLE_FIRST_CAPTURE_DEBUG=true`;
- com a flag ativa, o painel mostra um bloco colapsado `Validacao Etapa 1 — Modo Zen` so para o usuario autenticado atual;
- o bloco permite marcar a flag remota como `true`, marcar como `false`, limpar o cookie local e ativar/desativar a simulacao de falha remota da persistencia;
- se `SUPABASE_SERVICE_ROLE_KEY` estiver configurada localmente, o bloco tambem permite remover a linha de `user_app_state` do usuario atual para validar o caso realmente ausente;
- para validar o fallback: ative `Ativar falha remota`, confirme um item por voz, verifique que o painel normal continua liberado com cookie local, depois desative a falha e recarregue o painel para observar o retry remoto e a limpeza do cookie;
- no login, o bloco pre-login de instalacao continua aparecendo apenas quando o navegador realmente expuser `beforeinstallprompt`.

#### Estratégia de cache da Fase 2
- cachear apenas shell público e assets estáticos seguros;
- usar `network-first` para navegação;
- usar `stale-while-revalidate` para assets estáticos do app;
- nunca cachear respostas autenticadas, APIs nem páginas financeiras dinâmicas.

#### O que pode ficar disponível offline
- tela offline;
- login já pré-cacheado;
- manifest, favicon, ícones e assets estáticos do shell.

#### O que não fica disponível offline
- painel;
- revisão;
- resumo;
- liquidação;
- APIs autenticadas;
- dados financeiros do usuário.

#### Login atual no PWA instalado
O fluxo atual do MVP usa login com Google. Isso reduz fricção no app instalado e evita depender de retorno por link de e-mail fora da experiência principal.

### Push notifications
O Prumo usa Web Push para reengajar o usuário apenas quando existe ação útil:
- revisar lançamentos pendentes;
- acompanhar contas a pagar;
- acompanhar contas a receber.

#### Persistência
- `notification_preferences`: preferências simples por usuário
- `push_subscriptions`: subscriptions push por dispositivo/navegador

O arquivo [20260407_phase3_push_notifications.sql](/C:/Users/egidi/OneDrive/Documentos/Desenvolvimento/prumo-mvp/supabase/migrations/20260407_phase3_push_notifications.sql) contém a estrutura mínima para Supabase/Postgres.

#### Variáveis de ambiente necessárias
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `WEB_PUSH_CONTACT_EMAIL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATIONS_CRON_SECRET`

#### Como testar localmente
1. Rode o SQL da migration no banco do Supabase.
2. Configure as variáveis de ambiente.
3. Execute o app com HTTPS local quando quiser validar instalação e push no navegador compatível.
4. No painel, ative notificações e envie uma notificação de teste.
5. Para validar lembretes reais, faça um `POST` autenticado por segredo para `/api/notifications/reminders`.
6. Para a validação operacional final da Etapa 2, siga o checklist em [docs/05-checklist-de-release.md](/C:/Users/egidi/OneDrive/Documentos/Desenvolvimento/prumo-mvp/docs/05-checklist-de-release.md), incluindo as consultas SQL de `app_events` e `notification_deliveries`.

Exemplo de chamada manual:

```bash
curl -X POST http://localhost:3000/api/notifications/reminders ^
  -H "x-cron-secret: SEU_SEGREDO"
```

#### Estratégia dos lembretes
- pendentes: envia quando há lançamentos pendentes revisáveis
- contas a pagar: envia quando há contas abertas vencendo até amanhã ou já vencidas
- contas a receber: envia quando há contas abertas para acompanhar até amanhã ou já vencidas

Para reduzir spam, cada tipo de lembrete é enviado no máximo uma vez por dia por usuário.

#### Limitações conhecidas
- push depende de permissão do navegador/dispositivo
- iOS exige app instalado para web push funcionar
- o agendamento real depende da configuração externa do deploy
- os lembretes não incluem valores financeiros sensíveis no payload

### Papel de cada camada

#### Next.js
Responsável por:
- interface;
- rotas;
- fluxo entre gravação, revisão e confirmação;
- lógica de aplicação.

#### Supabase
Responsável por:
- autenticação;
- banco de dados;
- storage de áudios;
- persistência dos lançamentos.

#### Vercel
Responsável por:
- deploy;
- hospedagem;
- ambiente online do MVP.

---

## Estrutura conceitual do sistema

Em termos práticos, o Prumo funciona como um pipeline:

**voz → upload → interpretação → revisão → confirmação → histórico/resumo**

Esse pipeline é o núcleo do produto. Toda mudança técnica deve protegê-lo.

---

## Estrutura de documentação

A pasta `docs/` concentra a documentação operacional do projeto.

```text
docs/
  01-visao-produto-prumo.md
  02-regras-de-dominio.md
  03-arquitetura-mvp.md
  04-backlog.md
  05-checklist-de-release.md
  prompts/
    feature.md
    bugfix.md
    refactor.md
