# Operação e Migração — Sistema de Planejamento de Férias

## Objetivo operacional

O sistema centraliza o cadastro da equipe, os ciclos aquisitivos, os períodos de férias, as decisões de aprovação e as regras de cobertura. O planejamento deve ser administrado no sistema; planilhas devem ser usadas apenas como fonte de importação assistida ou como exportação de consulta.

| Papel | Responsabilidade principal |
|---|---|
| Consulta | Visualizar equipe, calendário, ciclos e alertas sem alterar dados. |
| Planejamento | Cadastrar e revisar colaboradores, ciclos e períodos; enviar solicitações e cancelar períodos quando permitido. |
| Aprovação | Decidir solicitações pendentes, com justificativa obrigatória para rejeição. |
| Administração | Gerir papéis, estruturas, regras de cobertura, importações, alertas e execução manual da verificação diária. |

## Regras de negócio implementadas

Cada ciclo pertence a um colaborador e contém direito de dias, abono, ajuste, referência e vencimento. O **saldo** considera somente períodos aprovados ou concluídos. Ajustes diferentes de zero exigem justificativa e o abono não pode exceder o direito do ciclo.

Os períodos são gravados inicialmente como rascunho ou solicitação. O fluxo permitido é apresentado na tabela abaixo. Toda decisão de status e toda edição de dados mestres ou planejamento gera registro de auditoria com usuário, horário e dados anteriores e posteriores.

| Estado atual | Próximos estados permitidos |
|---|---|
| Rascunho | Solicitação, cancelado |
| Solicitação | Aprovado, rejeitado, cancelado |
| Aprovado | Concluído, cancelado |
| Rejeitado | Rascunho, cancelado |
| Cancelado ou concluído | Sem transições adicionais |

As restrições operacionais podem bloquear integralmente aprovações em uma janela de tempo ou definir um máximo de ausências simultâneas por cargo, grupo operacional e/ou base. O bloqueio é verificado na aprovação e a capacidade é verificada tanto na aprovação quanto na rotina diária.

## Migração da planilha legada

A importação é assistida e não publica dados automaticamente. A administração deve enviar o arquivo XLSX, revisar a prévia, analisar pendências e confirmar explicitamente a publicação. A carga reconcilia colaboradores, cargos, bases, ciclos e períodos reconhecidos. Registros ambíguos, sem ciclo identificável ou sem datas suficientes permanecem como pendências e não devem ser incluídos sem conferência.

| Etapa | Controle obrigatório |
|---|---|
| Preparação | Salvar a planilha original em local corporativo controlado e evitar edição durante a importação. |
| Prévia | Conferir totais detectados, pendências por linha e mapeamento de ciclos e períodos. |
| Reconciliação | Validar nomes duplicados, cargos, bases e referências de ciclo antes da confirmação. |
| Publicação | Confirmar a carga somente após a aprovação operacional da prévia. |
| Pós-carga | Conferir calendário, saldos negativos, solicitações pendentes, alertas de qualidade e exportação de amostra. |

## Rotina diária e alertas

A verificação diária é idempotente: novas execuções atualizam alertas equivalentes pela chave de deduplicação em vez de duplicá-los. Ela verifica vencimentos próximos e vencidos, saldos negativos, solicitações pendentes, sobreposições, capacidade de cobertura e cadastros ativos sem cargo ou base. Cada execução registra início, término, duração, quantidade de registros analisados, alertas criados ou atualizados e eventual erro resumido.

Após a publicação da aplicação, a administração deve habilitar o agendamento gerenciado para a execução diária. Enquanto essa ativação não ocorrer, é possível executar a verificação manualmente na central de alertas.

## Recuperação e continuidade

Antes de mudanças estruturais, importe uma cópia de trabalho e crie uma versão recuperável do projeto. O arquivo original enviado fica preservado no armazenamento do sistema como evidência do lote; os dados do lote e suas pendências devem ser revisados antes de qualquer nova publicação. Para correções, prefira edição auditável dos cadastros, ciclos, períodos e restrições. Não execute exclusões ou alterações diretas no banco sem avaliar relações e impacto nos históricos.

Em uma indisponibilidade operacional, exporte o calendário filtrado em CSV ou XLSX para consulta temporária, restaure a última versão validada do projeto e reexecute a verificação diária após a recuperação. Ajustes manuais feitos durante a contingência devem ser registrados no sistema assim que o serviço retornar.
