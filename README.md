# Acessa Evento

App de eventos acessível: inscrição, agenda, ingresso que funciona sem internet, check-in por QR e um assistente guiado para tirar dúvidas. Evento de referência: Congresso COCAL 2026, no Centro de Eventos do Ceará, de 1 a 3 de julho de 2026.

> Projeto de portfólio. As 8 fases do MVP estão no código; faltam a revisão manual com leitores de tela e o primeiro build pelo EAS ([pendências](#pendências)). Veja o [plano de execução](#plano).

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

## Impacto

Medido em 10 de novembro de 2026. O que depende de aparelho ou de evento real está marcado como pendente, com o jeito de medir.

| Métrica | Resultado | Como foi medido |
| --- | --- | --- |
| Decisão do check-in sem internet | **mediana 2 ms, p95 3 ms** | `npm run medir -w apps/mobile`: 200 leituras com assinatura Ed25519 conferida e lista de 3.000 participantes, em Node no CI. No celular (Hermes, sem JIT) fica mais lento; a trava de regressão no CI é p95 abaixo de 250 ms. |
| Tempo da leitura até "Pode entrar" no aparelho | pendente | Cronômetro no celular da equipe, modo avião. Meta do plano: abaixo de 2 s. |
| Tempo de check-in antes (credenciamento atual) | pendente | Cronometrar a entrada do COCAL sem o app, para ter a linha de base. |
| Telas sem violação de acessibilidade | **14 telas × 3 temas = 42 auditorias, 0 violações** | Auditor em `apps/mobile/src/testes`: nome e papel de cada controle, alvo de 48 pt, contraste de cada texto com o fundo real, nenhum texto cortado. Achou 2 problemas reais, corrigidos: estrela de favorito com 1,5:1 e cartões sem alvo mínimo. |
| Recursos de acessibilidade cobertos | **8 de 8 implementados**, 2 aguardando revisão no aparelho | Libras, legenda e audiodescrição (selos, filtros, pedido na inscrição, aviso à equipe); rota sem degraus; alto contraste (do sistema ou escolhido); reduzir movimento (o app não tem animações, e um teste impede que entrem); leitor de tela e fonte em 200% (testes automáticos; revisão manual em [docs/acessibilidade.md](docs/acessibilidade.md)). |
| Funciona sem internet | **agenda, ingresso, check-in e assistente** | Cenários das features com a rede desligada, nos testes do app. |
| Testes | **178 no app, 131 de unidade e 45 de integração na API** | `npm run verify` no hook de push e no CI; integração contra PostgreSQL real. |
| Sessões sem falha | pendente | Sentry, durante o teste com usuários (meta acima de 99,5%). |

## Pendências

- Revisão manual com VoiceOver, TalkBack, fonte em 200% e teclado externo: [docs/acessibilidade.md](docs/acessibilidade.md).
- Primeiro build instalável: `npx eas-cli login`, `npx eas-cli init` e `npx eas-cli build -p android --profile preview` em `apps/mobile` (o perfil `preview` gera um APK com link). iOS precisa de conta de desenvolvedor Apple.
- API publicada (Render ou similar), com `QR_CHAVE_PRIVADA`, `SENTRY_DSN` e o usuário `app_api` ([ADR 0016](docs/adr/0016-banco-real-nos-testes-e-rls-sem-force.md)); o app aponta para ela por `EXPO_PUBLIC_API_URL`.
- Depois do MVP: canal em tempo real (confirmação de check-in, avisos, audiodescrição ao vivo), editor visual do assistente e limite de requisições por IP na borda.
