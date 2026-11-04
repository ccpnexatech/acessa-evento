# Acessa Evento

App de eventos acessível: inscrição, agenda, ingresso que funciona sem internet, check-in por QR e um assistente guiado para tirar dúvidas. Evento de referência: Congresso COCAL 2026, no Centro de Eventos do Ceará, de 1 a 3 de julho de 2026.

> Projeto de portfólio em construção. Fase atual: **5, inscrição e pagamento simulado** (fases 1 a 4 concluídas). Veja o [plano de execução](#plano).

## O que tem aqui

| Pasta | O que é |
| --- | --- |
| `apps/api` | API em Node 22 nativo (`node:http`, `node:test`), clean architecture por módulo. Sem framework. Migrações SQL em `db/migracoes`. |
| `apps/mobile` | App Expo (React Native) organizado por feature. |
| `packages/tokens` | Tokens do design system (3 temas) gerados de `tokens.json`, com teste de contraste WCAG. |
| `features/` | Comportamento esperado em Gherkin (pt-BR), um arquivo por fluxo. |
| `docs/adr/` | Decisões de arquitetura e seus trade-offs. |
| `docs/teste-manual.md` | Roteiro para subir banco, API e app e testar à mão. |
| `scripts/` | Portão de qualidade, verificação de segurança e validação de commits, sem dependências. |

## Como rodar

Requisitos: Node 22.18 ou mais novo e Docker (ou PostgreSQL 14+ instalado).

```bash
npm install      # instala tudo e liga os hooks do git
npm run dev      # banco, API, links públicos e app Expo, num comando
npm run verify   # lint, typecheck, testes, segurança e e2e
```

O `npm run dev` mostra um QR para abrir o app no celular, em qualquer rede, e os códigos de acesso no próprio terminal. Detalhes e opções em [docs/teste-manual.md](docs/teste-manual.md).

Em produção, a API conecta sempre com um usuário membro do papel `app_api`, nunca com o dono do esquema, para que a RLS valha ([ADR 0016](docs/adr/0016-banco-real-nos-testes-e-rls-sem-force.md)). As variáveis estão em `apps/api/.env.example`.

## Como contribuímos

- Commits em [Conventional Commits](https://www.conventionalcommits.org/pt-br/), direto na `master` ([ADR 0015](docs/adr/0015-fluxo-git-e-portao-de-qualidade.md)).
- O hook `pre-push` roda `npm run verify`; o CI roda o mesmo a cada push.
- Decisão nova vira ADR em `docs/adr/`.
- Domínio e aplicação não importam infraestrutura; o lint barra ([ADR 0014](docs/adr/0014-api-em-node-nativo.md)).

## Princípios

- **Nativo primeiro.** Recurso da plataforma antes de biblioteca; biblioteca só atrás de uma porta (SOLID + clean architecture).
- **Acessibilidade como regra.** WCAG 2.2 AA nos 3 temas, leitor de tela, fonte em 200%, alto contraste. O contraste é testado em código.
- **Offline onde importa.** Agenda, ingresso, check-in e assistente funcionam sem internet.
- **Dados mínimos.** LGPD: dados de acessibilidade apagados 30 dias após o evento; exportar e excluir a conta pelo app.

## Plano

| Fase | Entrega | Feature |
| --- | --- | --- |
| 1 | Fundação: monorepo, portão de qualidade, CI, `/saude` | — |
| 2 | Dados e segurança: migrações SQL, RLS, auditoria | — |
| 3 | Acesso sem senha e conta | `01-acesso-e-conta` |
| 4 | Agenda e palestra offline | `03-agenda-e-palestra` |
| 5 | Inscrição e pagamento simulado | `02-inscricao-e-pagamento` |
| 6 | Ingresso e credenciamento offline | `04-ingresso-e-credenciamento` |
| 7 | Assistente guiado | `05-assistente-guiado` |
| 8 | Auditoria de acessibilidade e lançamento | `06-acessibilidade` |

## API

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

Erros seguem o formato Problem Details (RFC 9457) com um `codigo` estável e uma mensagem pronta para a pessoa.

## Impacto

As métricas (tempo de check-in antes e depois, telas sem violação de acessibilidade, recursos cobertos) entram aqui conforme as fases fecham.
