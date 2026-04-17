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

# 7. Checklist final de decisão
Responder honestamente:

- [ ] Eu testei o fluxo principal inteiro
- [ ] Eu testei pelo menos um caso feliz e um caso com problema
- [ ] Eu entendo exatamente o que esta release altera
- [ ] Se der problema, eu sei qual commit ou branch reverter
- [ ] Esta versão deixa o Prumo melhor sem aumentar complexidade desnecessária

---

# 8. Regra final de release
Se qualquer item crítico do fluxo principal falhar, a release deve ser tratada como não pronta.

## Regra-mãe
No Prumo, estabilidade e clareza valem mais do que pressa.
