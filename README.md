# Acessa Evento

App de eventos acessível: inscrição, agenda, ingresso que funciona sem internet, check-in por QR e um assistente guiado para tirar dúvidas. Evento de referência: Congresso COCAL 2026, no Centro de Eventos do Ceará, de 1 a 3 de julho de 2026.

> Projeto de portfólio em construção. Fase atual: **1, fundação**. Veja o [plano de execução](#plano).

## O que tem aqui

| Pasta | O que é |
| --- | --- |
| `apps/api` | API em Node 22 nativo (`node:http`, `node:test`), clean architecture por módulo. Sem framework. |
| `apps/mobile` | App Expo (React Native) organizado por feature. |
| `packages/tokens` | Tokens do design system (3 temas) gerados de `tokens.json`, com teste de contraste WCAG. |
| `features/` | Comportamento esperado em Gherkin (pt-BR), um arquivo por fluxo. |
| `docs/adr/` | Decisões de arquitetura e seus trade-offs. |
| `scripts/` | Portão de qualidade, verificação de segurança e validação de commits, sem dependências. |

## Como rodar

Requisitos: Node 22.18 ou mais novo e npm 10.

```bash
npm install              # instala tudo e liga os hooks do git
npm run verify           # lint, typecheck, testes, segurança e e2e

npm start -w @acessa-evento/api      # API em http://localhost:3333/saude
npm start -w @acessa-evento/mobile   # app no Expo
```

A configuração da API fica em variáveis de ambiente; veja `apps/api/.env.example`.

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

## Impacto

As métricas (tempo de check-in antes e depois, telas sem violação de acessibilidade, recursos cobertos) entram aqui conforme as fases fecham.
