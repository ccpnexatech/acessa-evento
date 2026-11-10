# Revisão manual de acessibilidade

Os testes automáticos (`apps/mobile/src/testes/acessibilidade.test.tsx`) cobrem nome, papel, alvo de toque, contraste e corte de texto em 14 telas nos 3 temas. O que eles não provam (ordem de leitura, o que se ouve de fato, layout com fonte enorme) precisa de uma pessoa com o aparelho. Marque cada item e anote o aparelho e a data.

Aparelho: ______  Sistema: ______  Data: ______  Quem testou: ______

## VoiceOver (iPhone) e TalkBack (Android)

- [ ] Entrar: e-mail, "Receber código", código e primeiro acesso, só com gestos do leitor.
- [ ] Agenda: ouve "Agenda", o aviso sem internet (modo avião), as abas de dia como "aba, selecionada" e cada cartão numa frase só.
- [ ] Favoritar: ouve "Favoritar <título>, marcado".
- [ ] Detalhe da palestra: quando, onde, acessibilidade da sala e quem fala, nessa ordem.
- [ ] Inscrição: "Esgotado" é lido no ingresso que não pode ser escolhido; a mudança de passo é anunciada.
- [ ] Ingresso: o QR é anunciado como "QR do ingresso de <nome>. Mostre na entrada."
- [ ] Credenciamento: "Pode entrar", "Já entrou hoje" e "Ingresso não reconhecido" são falados sem procurar na tela.
- [ ] Assistente: ouve "Pergunta 1 de 2" e a pergunta antes das opções; ao voltar, a opção escolhida está "selecionada".

## Fonte em 200%

Ajuste o tamanho do texto do sistema no máximo (iOS: Ajustes > Acessibilidade > Tela e Tamanho do Texto > Texto Maior).

- [ ] Agenda e detalhe da palestra: nenhum título cortado com reticências.
- [ ] Nada fica escondido atrás da barra inferior; tudo rola até o fim.
- [ ] Botões do rodapé (Continuar, Pagar, Ler QR) continuam visíveis e tocáveis.
- [ ] Rótulos da barra de abas (Agenda, Ingresso, Ajuda) legíveis.

## Temas

- [ ] Escuro: todas as telas legíveis.
- [ ] Alto contraste em Ajuda: o app inteiro fica preto sobre branco; a escolha vale por cima das cores do evento.
- [ ] "Aumentar contraste" (iOS) ou "Texto em alto contraste" (Android) com a opção "Como o sistema".

## Teclado externo e switch

- [ ] Tab percorre os controles na ordem visual.
- [ ] O anel de foco de 3 pt aparece em cada controle.
- [ ] Espaço ou Enter aciona o controle focado.

## Resultado

Anote aqui o que falhou, com a tela e o passo. Cada falha vira um commit `fix(a11y): ...` e, se mudar uma regra, um ADR.
