# Referência de integração — Resend

O envio transacional usa o SDK oficial `resend` no servidor. A chave deve permanecer em `RESEND_API_KEY`, e o remetente deve usar domínio verificado, configurado em `EMAIL_FROM`. O envio precisa fornecer `from`, lista `to`, `subject` e conteúdo `html` ou `text`; a resposta deve ser tratada pelo par `{ data, error }` sem expor a chave ao cliente. Para evitar duplicações durante reexecuções da rotina diária, cada envio deve ter uma chave de idempotência própria, válida por até 24 horas.

## Fontes

- [Resend — Enviar e-mail pela API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend — Enviar e-mails com Node.js](https://resend.com/docs/send-with-nodejs)
