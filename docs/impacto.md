# Impacto

Medido em 10 de novembro de 2026. O que depende de aparelho ou de evento real está marcado como pendente, com o jeito de medir.

| Métrica | Resultado | Como foi medido |
| --- | --- | --- |
| Decisão do check-in sem internet | **mediana 2 ms, p95 3 ms** | `npm run medir -w apps/mobile`: 200 leituras com assinatura Ed25519 conferida e lista de 3.000 participantes, em Node no CI. No celular (Hermes, sem JIT) fica mais lento; a trava de regressão no CI é p95 abaixo de 250 ms. |
| Tempo da leitura até "Pode entrar" no aparelho | pendente | Cronômetro no celular da equipe, modo avião. Meta do plano: abaixo de 2 s. |
| Tempo de check-in antes (credenciamento atual) | pendente | Cronometrar a entrada do COCAL sem o app, para ter a linha de base. |
| Telas sem violação de acessibilidade | **14 telas × 3 temas = 42 auditorias, 0 violações** | Auditor em `apps/mobile/src/testes`: nome e papel de cada controle, alvo de 48 pt, contraste de cada texto com o fundo real, nenhum texto cortado. Achou 2 problemas reais, corrigidos: estrela de favorito com 1,5:1 e cartões sem alvo mínimo. |
| Recursos de acessibilidade cobertos | **8 de 8 implementados**, 2 aguardando revisão no aparelho | Libras, legenda e audiodescrição (selos, filtros, pedido na inscrição, aviso à equipe); rota sem degraus; alto contraste (do sistema ou escolhido); reduzir movimento (o app não tem animações, e um teste impede que entrem); leitor de tela e fonte em 200% (testes automáticos; revisão manual em [revisão manual](acessibilidade-revisao-manual.md)). |
| Funciona sem internet | **agenda, ingresso, check-in e assistente** | Cenários das features com a rede desligada, nos testes do app. |
| Testes | **178 no app, 131 de unidade e 45 de integração na API** | `npm run verify` no hook de push e no CI; integração contra PostgreSQL real. |
| Sessões sem falha | pendente | Sentry, durante o teste com usuários (meta acima de 99,5%). |


## Pendências

- Revisão manual com VoiceOver, TalkBack, fonte em 200% e teclado externo: [acessibilidade-revisao-manual.md](acessibilidade-revisao-manual.md).
- Primeiro build instalável: `npx eas-cli login`, `npx eas-cli init` e `npx eas-cli build -p android --profile preview` em `apps/mobile` (o perfil `preview` gera um APK com link). iOS precisa de conta de desenvolvedor Apple.
- API publicada (Render ou similar), com `QR_CHAVE_PRIVADA`, `SENTRY_DSN` e o usuário `app_api` ([ADR 0016](adr/0016-banco-real-nos-testes-e-rls-sem-force.md)); o app aponta para ela por `EXPO_PUBLIC_API_URL`.
- Depois do MVP: canal em tempo real (confirmação de check-in, avisos, audiodescrição ao vivo), editor visual do assistente e limite de requisições por IP na borda.
