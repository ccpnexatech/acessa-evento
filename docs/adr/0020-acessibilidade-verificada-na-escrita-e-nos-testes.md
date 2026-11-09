# 0020. Acessibilidade verificada na escrita, nos testes e no aparelho

- Status: Aceita
- Data: 2026-11-09

## Contexto

Acessibilidade é a razão de existir do app, não uma fase final. Até a fase 4, ela dependia de cuidado manual: testes buscavam por papel e nome, e os tokens tinham contraste testado. Faltavam três coisas: um aviso de rede que o VoiceOver anunciasse, o tema de alto contraste ligado de verdade e algo que barrasse, na escrita, um toque sem nome.

## Decisão

- **Lint próprio** (`tools/eslint/acessibilidade.mjs`), sem plugin de terceiros: `Pressable` e `Touchable*` exigem papel e nome (rótulo ou `<Text>` dentro), `TextInput` exige rótulo e `Image` exige descrição ou `accessible={false}`. Roda no `npm run lint`, portanto no push e no CI.
- **Anúncios:** avisos que mudam sozinhos usam região viva (Android) e `announceForAccessibility` no iOS. Sincronização de rotina não é anunciada, só a perda de conexão.
- **Alto contraste:** escolha em Ajuda (Como o sistema, Sempre ligado, Desligado), guardada no aparelho. "Como o sistema" segue "Aumentar contraste" no iOS e "Texto em alto contraste" no Android.
- **Testes:** cada tela é testada por papel, nome e estado; os cenários de 06-acessibilidade.feature viram testes conforme as telas existem. A passada manual com VoiceOver, TalkBack e fonte em 200% fica registrada no README por fase.

## Consequências

- Um botão sem nome não chega à master.
- As regras do lint são nossas para manter; cobrem os erros mais comuns, não tudo (ordem de foco e movimento seguem no teste manual).
- A prop `altoContraste` do `TemaProvider` continua para forçar o tema em testes.
