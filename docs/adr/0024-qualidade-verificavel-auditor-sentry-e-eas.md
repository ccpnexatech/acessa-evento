# 0024. Qualidade verificável: auditor de acessibilidade, Sentry sem SDK e build pelo EAS

- Status: Aceita
- Data: 2026-11-10

## Contexto

A fase 8 fecha o MVP com três promessas do plano: zero violações de acessibilidade nos 3 temas, erros monitorados no Sentry e app instalável por link. Ferramentas prontas existem para tudo (plugins de lint, `@sentry/react-native`, axe), mas a regra do projeto é nativo primeiro e terceiros só atrás de portas.

## Decisão

- **Auditor de acessibilidade próprio** sobre a árvore que a Testing Library renderiza. Cada tela, em cada tema, é auditada:
  - todo controle tem papel e nome;
  - alvo de 48 pt (altura, largura e `hitSlop`);
  - cada texto tem 4,5:1 com o fundo real, achado subindo na árvore (3:1 para texto grande);
  - nenhum `numberOfLines`.

  Um teste prova que o auditor pega cada tipo de falha. Um teste estático impede `Animated`, `LayoutAnimation`, limite de escala de fonte e `Pressable` fora do `Tocavel`.
- **Anel de foco** de 3 pt (`outline`, na cor `focusRing`) em todo controle, pelo componente `Tocavel`; o lint de acessibilidade também o vigia.
- **Sentry sem SDK:** a API e o app enviam o envelope do Sentry com `fetch`, atrás da porta `RelatorErros`:
  - só tipo, mensagem e pilha, com e-mails e tokens cortados, mais etiquetas técnicas (rota, id da requisição);
  - sem DSN, nada sai;
  - na API: erros 500 e promessas sem tratamento;
  - no app: o tratador global e o `ErrorBoundary` do Expo Router, que mostra uma tela "Algo deu errado" no lugar da tela vermelha.
- **EAS:** `eas.json` com `preview` (APK interno com link, evento de simulação) e `production`. O build roda na conta Expo do dono do projeto.
- **Medição como teste:** o tempo de decisão do check-in offline é medido num teste que também trava regressão (p95 abaixo de 250 ms).

## Consequências

- O auditor cobre as regras mais comuns da WCAG 2.2 AA, não todas. Ordem de leitura, anúncios e layout com fonte enorme continuam na revisão manual (`docs/acessibilidade.md`).
- O relator próprio não captura falhas nativas (crash fora do JavaScript) nem faz agrupamento por source map. Se isso fizer falta, o `@sentry/react-native` entra como outro adaptador da mesma porta.
- O número da medição vem do Node no CI; o tempo no aparelho ainda precisa de cronômetro.
