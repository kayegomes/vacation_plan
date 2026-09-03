# Registro de validação visual

- A tela **Restrições de ausência** foi verificada em desktop: o formulário apresenta escopo, período, motivo, bloqueio de aprovação e a listagem de janelas de cobertura com estado vazio compreensível.
- A central **Alertas e tratativas** foi verificada em desktop: os filtros por status, categoria, severidade, colaborador, estrutura e período estão organizados, legíveis e acompanhados pelos indicadores e histórico de execução.
- Após a inclusão da capacidade máxima de ausências, a suíte passou com **23 testes** e a checagem de tipos foi concluída sem erros.

## Manutenção auditável

As telas **Equipe e estruturas** e **Restrições de ausência** foram verificadas em desktop. A equipe apresenta cadastro mestre, filtro de situação, cartões de estruturas e uma área de manutenção auditável para cargos, grupos e bases. A tela de restrições mantém boa hierarquia visual para escopo, período, motivo, bloqueio e limite de ausências, além de uma lista de regras vigentes preparada para edição administrativa.

As mesmas telas foram verificadas em viewport móvel de 390 px. Os controles permanecem em coluna, os campos seguem legíveis, os botões preservam área de toque adequada e os estados vazios não ocultam a orientação operacional.

## Hotfix de agendamento

A página **Importação da planilha** foi carregada após a correção da consulta `dailyCheckSchedule`. O módulo apresentou o fluxo de prévia normalmente, sem o erro de dados indefinidos observado antes do ajuste. A consulta agora normaliza a ausência de agendamento para `null`, situação confirmada por teste de procedure.

## Notificações por e-mail

A área **Notificações por e-mail** foi verificada em desktop e em viewport móvel de 390 px. O módulo apresenta o estado de configuração do Resend, o formulário de destinatários, a explicação de idempotência, os controles de teste e a auditoria de entregas sem comprometer a legibilidade ou a hierarquia visual em telas menores.

## Identidade simplificada

A navegação foi verificada em viewport desktop de 1280 × 720 px. O cabeçalho agora apresenta somente **Férias** e o cartão informativo lateral é ocultado em alturas compactas, preservando todos os itens de navegação sem sobreposição com o rodapé.

## Reconciliação de períodos importados

A fila de reconciliação foi verificada com os 142 períodos reais que ficaram sem ciclo reconhecido na carga. A interface apresenta busca, ciclos candidatos do próprio colaborador, nota de auditoria e paginação de 15 itens, evitando uma lista extensa e preservando a revisão explícita antes de qualquer impacto em calendário ou saldo.
