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
| `GET /conta/exportacao` | Baixa todos os dados da pessoa (LGPD), inclusive credenciais, declaração de meia-entrada e vínculos com organizações e parceiros |
| `DELETE /conta` | Exclui a conta |
| `GET /eventos/:slug/agenda` | Agenda publicada, com `ETag` e `304` quando nada mudou |
| `GET /eventos/:slug/favoritos` | Atividades favoritas da pessoa |
| `PUT /favoritos/:atividadeId` | Marca como favorita (idempotente) |
| `DELETE /favoritos/:atividadeId` | Desmarca (idempotente) |
| `GET /eventos` | Eventos publicados; `?recurso=libras` filtra pelo que o evento oferece |
| `GET /eventos/:slug` | Página do evento: tipos de ingresso (com esgotado), acessibilidade e destaques |
| `POST /eventos/:slug/inscricoes` | Inscrição e pagamento simulado; exige `Idempotency-Key` (a mesma chave nunca cobra duas vezes). Ingresso de meia-entrada exige `motivoMeia`; o documento é conferido na entrada, nunca enviado |
| `GET /ingressos` | Ingressos da pessoa, com o QR assinado e o primeiro check-in |
| `GET /credenciamento/eventos` | Eventos em que a pessoa é da equipe |
| `GET /credenciamento/:slug/pacote` | Lista do evento e chaves públicas para o leitor offline (só equipe) |
| `POST /credenciamento/:slug/checkins` | Envia a fila de check-ins (idempotente; o primeiro pelo horário vale) |
| `GET /eventos/:slug/assistente` | Última versão do assistente guiado, com `ETag` |
| `PUT /eventos/:slug/assistente` | Publica uma nova versão (organização; grafo validado) |
| `POST /eventos/:slug/assistente/avaliacoes` | "Isso respondeu sua dúvida?", sem dados pessoais |

## Área do organizador

Todas exigem sessão e respondem com `cache-control: private, no-store`. Quem pode o quê é decidido pela RLS do banco ([ADR 0029](adr/0029-api-do-organizador-cadastros-declarativos.md)).

### Organização, evento e equipe

| Método e rota | O que faz |
| --- | --- |
| `GET /organizador/inicio` | Organizações e eventos em que a pessoa trabalha, com os papéis, e convites esperando resposta |
| `POST /organizador/organizacoes` | Cria a organização; quem cria vira dono |
| `POST /organizador/organizacoes/:organizacaoId/eventos` | Cria um evento em rascunho (ou de demonstração) |
| `POST /organizador/organizacoes/:organizacaoId/convites` | Convida para dono ou admin da organização (só o dono) |
| `GET /organizador/eventos/:slug` | Início do evento: dados, papéis de quem pergunta, checklist de prontidão e números |
| `PATCH /organizador/eventos/:slug` | Altera dados, publica e define a aparência (cores só da paleta) |
| `GET /organizador/eventos/:slug/equipe` | Equipe com nome e papéis, convites e a frase que explica cada papel |
| `PUT /organizador/eventos/:slug/equipe/:pessoaId` | Define os papéis, o cargo e se aparece na página do evento |
| `DELETE /organizador/eventos/:slug/equipe/:pessoaId` | Tira a pessoa da equipe |
| `POST /organizador/eventos/:slug/convites` | Convida por e-mail com um ou mais papéis; vale 14 dias |
| `DELETE /organizador/convites/:id` | Cancela um convite ainda não respondido |
| `GET /convites` | Convites pendentes para o e-mail de quem está logado |
| `POST /convites/:id/aceitar` | Aceita o convite; `409` se venceu, foi cancelado ou é de outro e-mail |

Para quem não é da equipe, o evento na área do organizador responde `404`.

### Controle de acesso

| Método e rota | O que faz |
| --- | --- |
| `GET /organizador/eventos/:slug/regras-zona` | Quem entra em cada zona, por categoria e janela de horário |
| `PUT /organizador/eventos/:slug/zonas/:zonaId/regras` | Troca as regras da zona (a lista enviada substitui a anterior) |
| `GET /organizador/eventos/:slug/credenciais` | Credenciais do evento, com a primeira entrada, e as exceções |
| `POST /organizador/eventos/:slug/credenciais` | Emite credencial para um e-mail (cria a conta se preciso); congressista recebe a sua ao se inscrever |
| `POST /organizador/eventos/:slug/credenciais/:id/revogar` | Cancela a credencial, com motivo |
| `PUT` e `DELETE /organizador/eventos/:slug/credenciais/:id/excecoes/:zonaId` | Libera ou barra uma pessoa numa zona, com motivo |
| `GET /organizador/eventos/:slug/hoje` | "Chegou o dia": entradas registradas por ponto e pontos sem sincronizar |
| `GET /acessos/:slug/pacote` | Tudo o que o leitor precisa sem internet: chaves, credenciais (inclusive canceladas), zonas, regras, exceções, pontos e meias a conferir |
| `POST /acessos/:slug/leituras` | Envia a fila do leitor (idempotente). Cada leitura volta como `registrada`, `repetida` ou `ignorada` |
| `POST /acessos/:slug/meias/:id/conferir` | Marca a meia-entrada como conferida ou não apresentada |
| `GET /eventos/:slug/avisos` | Avisos já publicados para a categoria de quem está logado |
| `GET /credenciais` | Credenciais da pessoa, com o QR assinado de cada uma ([ADR 0030](adr/0030-qr-da-credencial-sem-ingresso.md)) |

A rota `/credenciamento` da v1.0.0 continua igual.

### Feira, portal do expositor e contratos

| Método e rota | O que faz |
| --- | --- |
| `GET /organizador/eventos/:slug/feira` | Parceiros do evento com estandes, nível calculado, credenciais, montagem, contrato e serviços |
| `POST /organizador/eventos/:slug/montagens/:parceiroEventoId/analisar` | Aprova ou recusa a montagem (recusar exige dizer o que corrigir) |
| `PATCH /organizador/eventos/:slug/pedidos-servico/:id` | Confirma ou cancela um pedido de serviço |
| `GET` e `POST /organizador/eventos/:slug/contratos` | Lista e cria contrato, a partir de um modelo ou de texto próprio |
| `PATCH /organizador/eventos/:slug/contratos/:id` | Altera o rascunho; depois de enviado o texto não muda |
| `POST /organizador/contratos/:id/enviar` e `…/cancelar` | Envia ao contratado ou cancela |
| `POST /organizador/contratos/:id/registrar-assinatura` | Registra assinatura feita fora do app (gov.br ou provedor), com o protocolo |
| `GET /portal` | Participações em que a pessoa é responsável ou equipe de um parceiro |
| `GET /portal/:id` | O espaço do expositor: resumo, próximo nível, estandes, marca, serviços, montagem, equipe, contratos e o que falta fazer |
| `PUT` e `DELETE /portal/:id/estandes/:estandeId` | Reserva por 48 horas (`409` se outro reservou antes) e desiste da reserva |
| `PUT /portal/:id/perfil` | Marca no app; logo só com descrição para leitor de tela |
| `PUT` e `DELETE /portal/:id/servicos/:servicoId` | Pede um serviço (valor calculado) e cancela |
| `PUT /portal/:id/montagem` | Montagem básica, montadora própria ou estande diferente |
| `POST /portal/:id/convites` | A organização convida o responsável; o responsável convida a equipe |
| `POST /portal/:id/credenciais` | Emite a credencial de alguém da equipe; só com contrato assinado e dentro do limite por metragem |
| `GET /contratos` | Contratos enviados a quem está logado, com o texto para ler |
| `POST /contratos/:id/assinar` | Aceite no app por quem contrata |
| `GET /eventos/:slug/expositores` | Público: expositores com perfil publicado (ordem alfabética, nível como rótulo) e o mapa da feira |

Um expositor nunca enxerga o espaço de outro: para ele, a participação alheia responde `404`.

### Cadastros simples

Cada cadastro tem as mesmas quatro rotas: `GET` (lista), `POST` (cria), `PATCH /:id` (altera parte) e `DELETE /:id`.

| Base | Cadastros |
| --- | --- |
| `/organizador/organizacoes/:organizacaoId/…` | `locais`, `parceiros`, `modelos-contrato` |
| `/organizador/eventos/:slug/…` | `zonas`, `salas`, `palestrantes`, `atividades`, `pontos-leitura`, `tipos-ingresso`, `avisos`, `segmentos`, `plantas`, `tipos-estande`, `estandes`, `niveis-expositor`, `servicos-feira`, `parceiros-evento` (sem `PATCH`) |

Campo desconhecido é recusado com `422`; nome repetido ou registro em uso, `409`; sem o papel, `403` ao criar e `404` ao alterar ou apagar.

Erros seguem o formato Problem Details (RFC 9457) com um `codigo` estável e uma mensagem pronta para a pessoa.


## Formato de erro

```json
{ "titulo": "Pagamento não aprovado. Tente outro cartão ou pague com Pix.", "status": 402, "codigo": "pagamento_recusado", "idRequisicao": "…" }
```

O `codigo` é estável para o app decidir o que fazer; o `titulo` é a frase pronta para a pessoa. O `idRequisicao` é o mesmo do cabeçalho `x-request-id` e dos logs.
