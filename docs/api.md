# API

Todas as rotas, em ordem de fluxo. A API é Node 22 nativo (`node:http`), sem framework ([ADR 0014](adr/0014-api-em-node-nativo.md)).

| Método e rota | O que faz |
| --- | --- |
| `GET /saude` | Estado da API e do banco (monitor de disponibilidade) |
| `POST /acesso/codigo` | Envia o código de 6 números para o e-mail |
| `POST /acesso/entrar` | Troca e-mail + código por uma sessão; cria a conta no primeiro login |
| `POST /acesso/sair` | Encerra a sessão atual |
| `GET /conta` | Dados da conta |
| `PUT /conta/primeiro-acesso` | Nome do crachá e aceite dos termos |
| `GET /conta/exportacao` | Baixa todos os dados da pessoa (LGPD) |
| `DELETE /conta` | Exclui a conta |
| `GET /eventos/:slug/agenda` | Agenda publicada, com `ETag` e `304` quando nada mudou |
| `GET /eventos/:slug/favoritos` | Atividades favoritas da pessoa |
| `PUT /favoritos/:atividadeId` | Marca como favorita (idempotente) |
| `DELETE /favoritos/:atividadeId` | Desmarca (idempotente) |
| `GET /eventos` | Eventos publicados; `?recurso=libras` filtra pelo que o evento oferece |
| `GET /eventos/:slug` | Página do evento: tipos de ingresso (com esgotado), acessibilidade e destaques |
| `POST /eventos/:slug/inscricoes` | Inscrição e pagamento simulado; exige `Idempotency-Key` (a mesma chave nunca cobra duas vezes) |
| `GET /ingressos` | Ingressos da pessoa, com o QR assinado e o primeiro check-in |
| `GET /credenciamento/eventos` | Eventos em que a pessoa é da equipe |
| `GET /credenciamento/:slug/pacote` | Lista do evento e chaves públicas para o leitor offline (só equipe) |
| `POST /credenciamento/:slug/checkins` | Envia a fila de check-ins (idempotente; o primeiro pelo horário vale) |
| `GET /eventos/:slug/assistente` | Última versão do assistente guiado, com `ETag` |
| `PUT /eventos/:slug/assistente` | Publica uma nova versão (organização; grafo validado) |
| `POST /eventos/:slug/assistente/avaliacoes` | "Isso respondeu sua dúvida?", sem dados pessoais |

Erros seguem o formato Problem Details (RFC 9457) com um `codigo` estável e uma mensagem pronta para a pessoa.


## Formato de erro

```json
{ "titulo": "Pagamento não aprovado. Tente outro cartão ou pague com Pix.", "status": 402, "codigo": "pagamento_recusado", "idRequisicao": "…" }
```

O `codigo` é estável para o app decidir o que fazer; o `titulo` é a frase pronta para a pessoa. O `idRequisicao` é o mesmo do cabeçalho `x-request-id` e dos logs.
