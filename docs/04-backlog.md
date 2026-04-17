# Prumo — Backlog Operacional

## Objetivo deste documento
Este backlog existe para manter a evolução do Prumo organizada, priorizada e sempre quebrada em tarefas pequenas e executáveis.

## Regra de uso
Toda tarefa deve ser:
- específica;
- pequena;
- testável;
- compatível com o estágio atual do MVP.

Evitar tarefas vagas como:
- “melhorar o app”
- “otimizar tudo”
- “revisar o sistema inteiro”

---

# Prioridade atual do projeto
O MVP do Prumo já está funcional. O foco agora é **refinamento com segurança**, priorizando:

1. estabilidade do fluxo principal;
2. clareza da revisão;
3. consistência dos lançamentos;
4. qualidade do resumo;
5. redução de atrito.

---

# Backlog

## P0 — Crítico
Itens que afetam diretamente o funcionamento do MVP e a confiança no produto.

- [ ] Garantir que o fluxo de gravação até geração de pendente esteja estável
- [ ] Garantir que o usuário consiga confirmar um pendente sem travas
- [ ] Garantir que o usuário consiga descartar um pendente sem travas
- [ ] Validar o comportamento quando a transcrição vier vazia ou ruim
- [ ] Validar o comportamento quando a interpretação vier incompleta
- [ ] Garantir que o histórico reflita corretamente os confirmados
- [ ] Garantir que o resumo financeiro reflita corretamente os lançamentos confirmados
- [ ] Revisar tratamento de erro em upload de áudio
- [ ] Revisar tratamento de erro em processamento do áudio
- [ ] Revisar feedback visual para estados de processamento

---

## P1 — Alta prioridade
Itens que melhoram a experiência principal e reduzem atrito.

- [ ] Refinar os textos da tela principal para reforçar simplicidade
- [ ] Refinar botão de gravação para ficar mais claro
- [ ] Refinar feedback visual após término da gravação
- [ ] Melhorar experiência de revisão do pendente
- [ ] Garantir que, ao confirmar um pendente, o próximo pendente seja aberto automaticamente
- [ ] Garantir que, ao descartar um pendente, o próximo pendente seja aberto automaticamente
- [ ] Exibir mensagem clara quando não houver mais pendentes
- [ ] Validar que o usuário consegue continuar gravando novos áudios enquanto itens anteriores processam
- [ ] Simplificar a leitura das informações na tela de confirmação
- [ ] Melhorar clareza entre “confirmado”, “pendente” e “descartado”

---

## P2 — Média prioridade
Itens de consistência, manutenção e polimento.

- [ ] Revisar nomenclatura de campos e labels para manter consistência
- [ ] Revisar mensagens de erro para linguagem mais clara
- [ ] Mapear pontos do código com chance de refatoração localizada
- [ ] Identificar duplicações simples que podem ser reduzidas
- [ ] Revisar componentes que cresceram demais
- [ ] Revisar organização de funções do fluxo principal
- [ ] Criar checklist de testes manuais por fluxo
- [ ] Revisar estados de loading e feedback visual
- [ ] Melhorar organização do código de resumo financeiro
- [ ] Melhorar organização do código de histórico

---

## P3 — Futuro próximo
Itens úteis, mas que não devem competir com estabilidade do núcleo.

- [ ] Ajustar filtros mínimos no histórico
- [ ] Melhorar seletor de período do resumo
- [ ] Permitir edição simples durante a revisão, se fizer sentido
- [ ] Refinar entrada manual para usar o mesmo padrão visual da revisão
- [ ] Melhorar visual geral sem aumentar complexidade
- [ ] Preparar base para futuras métricas do usuário
- [ ] Pensar em onboarding inicial simples
- [ ] Pensar em feedback de sucesso mais claro após confirmação

---

# Tarefas recorrentes
Estas tarefas não são únicas; devem acontecer continuamente.

- [ ] Testar fluxo completo após mudanças importantes
- [ ] Revisar se cada mudança preserva simplicidade extrema
- [ ] Verificar se novas alterações criam campos ou etapas desnecessárias
- [ ] Revisar se o produto continua mobile-first
- [ ] Confirmar que o núcleo do Prumo continua sendo voz + revisão rápida

---

# Critérios de priorização
Uma tarefa sobe de prioridade quando:

- afeta diretamente a gravação;
- afeta o upload;
- afeta a interpretação;
- afeta a revisão;
- afeta a confirmação;
- afeta a confiança do usuário no lançamento gerado.

---

# Regra de execução
Antes de desenvolver qualquer item deste backlog, a tarefa deve ser reescrita em formato operacional:

## Modelo
**Tarefa:**  
[descrever em uma frase]

**Problema atual:**  
[descrever o problema]

**Resultado esperado:**  
[descrever o comportamento correto]

**Arquivos prováveis:**  
[listar arquivos relevantes]

**Teste manual:**  
[descrever como validar]

---

# Itens concluídos
Mover para esta seção somente tarefas realmente fechadas e validadas.

## Concluídos
- [x] Etapa 1 do Modo Zen fechada no fluxo principal: gate por `has_completed_first_capture`, desbloqueio só após confirmação final por voz, fallback local por cookie de sessão e painel normal liberado sem retorno ao Zen na mesma sessão
