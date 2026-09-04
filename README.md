# Férias

Aplicação web responsiva para **planejar, aprovar e acompanhar férias** de forma centralizada. O sistema substitui controles manuais em planilhas por um fluxo auditável, com calendário consolidado, gestão de direitos, alertas operacionais, importação assistida e perfis de acesso.

> Este repositório contém apenas código e documentação técnica. **Não** inclui dados de colaboradores, relatórios de importação, credenciais, tokens ou arquivos de ambiente.

## Recursos principais

| Área | Capacidades |
| --- | --- |
| Autenticação | Contas internas por e-mail e senha, convite de uso único, recuperação e troca de senha, suspensão de conta e sessão protegida. |
| Acessos | Perfis de consulta, planejamento, aprovação e administração aplicados na interface e na API. |
| Cadastro mestre | Colaboradores, cargos, grupos operacionais e bases, com manutenção auditável e situação ativa. |
| Planejamento | Ciclos de férias, direitos, abono, saldos, períodos fracionados, exceções e fluxo de rascunho, solicitação, aprovação, rejeição, cancelamento e conclusão. |
| Calendário | Visão consolidada com filtros por período, cargo, grupo, base e status, além do destaque de sobreposições. |
| Importação | Prévia de arquivos XLSX, validações, reconciliação, publicação confirmada e fila de itens que exigem decisão humana. |
| Alertas | Vencimentos, pendências, saldos negativos, conflitos, qualidade de dados e falhas técnicas, com histórico de tratativa. |
| Notificações | Verificação interna diária e resumo de e-mails semanal; falhas técnicas críticas seguem comunicação imediata. |

## Arquitetura

O projeto usa uma aplicação full-stack TypeScript:

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, Vite, Tailwind CSS 4 e componentes baseados em Radix UI. |
| API | Express 4 e tRPC 11, com contratos tipados de ponta a ponta. |
| Persistência | Drizzle ORM com MySQL/TiDB. |
| Autenticação | Sessões próprias em cookie `HttpOnly`, credenciais de senha protegidas por hash e controle de acesso por perfil. |
| E-mail | Resend, configurado exclusivamente no servidor por variáveis de ambiente. |
| Agendamentos | Callbacks seguros para verificação diária e resumo semanal, a serem acionados por um agendador compatível com o ambiente de hospedagem. |
| Testes | Vitest, Testing Library e JSDOM para regras de domínio, API e jornadas críticas de interface. |

## Pré-requisitos

Para executar localmente, instale **Node.js 22+**, **pnpm 10+** e uma instância MySQL ou TiDB compatível. Para notificações por e-mail, utilize uma conta Resend com remetente previamente verificado.

## Configuração local

Clone o repositório, instale as dependências e crie um arquivo `.env.local` que nunca deve ser enviado ao Git:

```bash
git clone https://github.com/kayegomes/vacation_plan.git
cd vacation_plan
pnpm install
```

```dotenv
# Banco de dados MySQL/TiDB
DATABASE_URL="mysql://usuario:senha@host:3306/ferias"

# Use um valor aleatório longo e exclusivo por ambiente.
JWT_SECRET="gere-um-segredo-longo-e-unico"

# Necessário para convites, redefinições e alertas por e-mail.
RESEND_API_KEY="re_xxxxxxxxx"
EMAIL_FROM="Férias <alertas@seu-dominio-verificado.com>"
```

Depois, gere/aplique as migrações conforme a política do seu ambiente e inicie o servidor de desenvolvimento:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm dev
```

> Revise as migrações geradas antes de aplicá-las em ambientes compartilhados ou de produção. Faça backup antes de alterações estruturais no banco.

## Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `pnpm dev` | Inicia o ambiente de desenvolvimento. |
| `pnpm build` | Gera o bundle de produção. |
| `pnpm start` | Executa o bundle de produção. |
| `pnpm test` | Executa testes unitários e de interface. |
| `pnpm check` | Executa a verificação estática de TypeScript. |
| `pnpm drizzle-kit generate` | Gera uma migração a partir do esquema Drizzle. |
| `pnpm drizzle-kit migrate` | Aplica migrações pendentes ao banco configurado. |

## Rotinas automáticas

O código separa **detecção interna** de **comunicação por e-mail**. A verificação diária atualiza alertas e histórico; o resumo semanal consolida ocorrências abertas para os destinatários ativos. No ambiente operacional de referência, o resumo é previsto para **segunda-feira, às 08:00, no horário de Brasília**.

Ao hospedar fora do ambiente gerenciado, configure um agendador confiável para chamar os callbacks protegidos da aplicação. Não exponha rotas de agendamento sem autenticação adequada e não execute tarefas com dados sensíveis no cliente.

## Importação e reconciliação

A importação é deliberadamente assistida. O fluxo recomendado é:

1. Enviar uma cópia de trabalho do XLSX.
2. Revisar a prévia e as pendências identificadas.
3. Confirmar explicitamente a publicação dos registros reconhecidos.
4. Usar a fila de **Conciliação** para vincular períodos ambíguos a ciclos do mesmo colaborador ou descartá-los com justificativa.
5. Revisar calendário, saldos e histórico após a resolução da fila.

Arquivos reais, relatórios de prévia e scripts operacionais de carga são intencionalmente ignorados pelo Git para preservar a confidencialidade dos dados de RH.

## Segurança e privacidade

O projeto foi estruturado para reduzir a exposição de dados pessoais e credenciais:

- Os segredos são lidos apenas por variáveis de ambiente no servidor; nenhum valor de chave é versionado.
- Senhas nunca são armazenadas em texto simples. Convites e redefinições usam tokens temporários de uso único e somente seu hash é persistido.
- Sessões são emitidas em cookies seguros e os perfis são validados também no servidor.
- Ações administrativas, fluxos de férias, importações e reconciliações mantêm trilha de auditoria.
- Relatórios contendo dados reais de colaboradores e scripts de execução pontual ficam fora do repositório por meio de `.gitignore`.

## Estrutura de diretórios

```text
client/       # Interface React e componentes
server/       # API tRPC, regras de domínio, autenticação e rotinas
drizzle/      # Esquema e migrações do banco de dados
shared/       # Tipos e constantes compartilhados
docs/         # Documentação técnica sanitizada
```

## Contribuição

Antes de abrir uma alteração, execute `pnpm test` e `pnpm check`. Evite incluir dados de pessoas, arquivos de ambiente, chaves, tokens, relatórios operacionais ou planilhas reais em commits. Para mudanças de banco, mantenha o esquema Drizzle e a migração correspondente revisados e sincronizados.
