export const guideModules = [
  {
    title: "1. Visão geral: comece pelo que exige atenção",
    description: "O painel inicial resume colaboradores ativos, solicitações aguardando decisão, vencimentos próximos, saldos negativos e alertas abertos. Use-o no início da rotina para decidir onde atuar primeiro.",
    action: "Abra os cartões ou navegue para Planejamento, Calendário e Alertas conforme a prioridade indicada.",
  },
  {
    title: "2. Cadastre e mantenha a equipe",
    description: "Em Equipe, a administração cria e atualiza colaboradores, cargos, grupos operacionais e bases. Esses dados estruturam os filtros, os limites de cobertura e os relatórios.",
    action: "Cadastre primeiro cargos, grupos e bases; depois inclua o colaborador com nome, situação e vínculos organizacionais corretos.",
  },
  {
    title: "3. Crie ciclos e planeje períodos",
    description: "Em Planejamento, o responsável registra o ciclo de férias, incluindo referência, vencimento, direito, abono e ajuste autorizado. Depois lança um ou mais períodos vinculados ao ciclo.",
    action: "Verifique o saldo calculado antes de enviar o período para aprovação. Registre justificativa quando o sistema solicitar uma exceção.",
  },
  {
    title: "4. Aprove ou trate solicitações",
    description: "Períodos passam por rascunho, solicitação, aprovação, rejeição, cancelamento e conclusão. Rejeições e cancelamentos exigem justificativa e cada decisão fica registrada no histórico.",
    action: "Antes de aprovar, confira o calendário, o saldo do ciclo e as restrições de cobertura. Use comentário objetivo para explicar decisões.",
  },
  {
    title: "5. Consulte conflitos no calendário",
    description: "O Calendário reúne os períodos por data e permite filtrar por cargo, grupo, base e status. Sobreposições são destacadas para apoiar a verificação de cobertura.",
    action: "Aplique os filtros do seu recorte operacional e exporte somente o resultado necessário em Excel ou CSV.",
  },
  {
    title: "6. Acompanhe alertas e e-mails",
    description: "Alertas centralizam vencimentos próximos ou vencidos, saldos negativos, pendências de aprovação, conflitos, qualidade de dados e falhas da rotina diária. A área de E-mails controla destinatários e mostra o histórico do resumo semanal.",
    action: "Reconheça, resolva ou dispense o alerta com uma nota de tratativa. O resumo é enviado às segundas-feiras, às 08:00; só administradores alteram destinatários e fazem testes de envio.",
  },
  {
    title: "7. Importe planilhas com segurança",
    description: "Em Importação, envie uma planilha XLSX para prévia. O sistema apresenta totais e pendências; nenhum registro é publicado automaticamente. A publicação só acontece após confirmação administrativa.",
    action: "Revise os avisos antes de confirmar. Registros sem dados reconhecíveis permanecem fora da carga, evitando que inconsistências afetem o planejamento.",
  },
  {
    title: "8. Reconcilie períodos sem ciclo",
    description: "A área Conciliação guarda períodos importados que não puderam ser vinculados automaticamente a um ciclo. Cada item é ligado manualmente apenas a um ciclo do mesmo colaborador, com nota de auditoria opcional.",
    action: "Confira pessoa, datas e referência da planilha; escolha o ciclo correto e use Vincular. O período então passa a compor o calendário, o saldo e as regras de cobertura.",
  },
] as const;

export const roleGuidance = [
  { role: "Consulta", description: "Visualiza painel, calendário, dados e alertas conforme os filtros disponíveis. Não altera cadastros nem aprova solicitações." },
  { role: "Planejamento", description: "Além da consulta, mantém colaboradores e estruturas, cria ciclos e períodos, trata reconciliações e registra informações operacionais." },
  { role: "Aprovação", description: "Analisa solicitações recebidas e pode aprovar, rejeitar, cancelar ou concluir períodos, respeitando as regras de cobertura." },
  { role: "Administração", description: "Possui todas as permissões, administra acessos, restrições, destinatários de e-mail, importações e a rotina diária." },
] as const;

export const statusGuide = [
  { label: "Rascunho", description: "Lançamento em preparação; ainda não está na fila de decisão." },
  { label: "Solicitado", description: "Período enviado para análise e aprovação." },
  { label: "Aprovado", description: "Período confirmado; passa a ser considerado nas regras de cobertura." },
  { label: "Rejeitado", description: "Solicitação não aprovada; o motivo fica no histórico." },
  { label: "Cancelado", description: "Período interrompido com justificativa registrada." },
  { label: "Concluído", description: "Férias finalizadas; não pode mais ser editado." },
] as const;
