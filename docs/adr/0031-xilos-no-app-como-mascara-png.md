# 0031. Xilos no app como máscara PNG colorida pelo tema

- Status: Aceita
- Data: 2026-11-16
- Detalha: [0010](0011-design-system-com-tema-de-5-chaves-e-3-temas-fixos-de-a.md)

## Contexto

A carteira de xilos (`packages/xilos`) guarda as gravuras em SVG de uma tinta só, com `currentColor`, para seguir o tema. O React Native não desenha SVG: o componente `Image` nativo só aceita imagem rasterizada, e o caminho usual é a biblioteca `react-native-svg`. O projeto decidiu evitar bibliotecas para manter o app leve e próprio, e o QR do ingresso já é desenhado com `View` pelo mesmo motivo.

A gravura precisa de três coisas no app: trocar de cor com o tema (claro, escuro, alto contraste), ficar nítida em telas densas e não pesar no pacote.

## Decisão

1. **O SVG continua sendo a fonte.** `tools/xilo/mascaras.py` gera, de cada peça escolhida, uma **máscara PNG**: branco opaco onde há tinta, transparente no resto, em tons de cinza com alfa.
2. **O app colore a máscara com `tintColor`**, que o `Image` do React Native tem em iOS, Android e web. A cor vem do tema, então a mesma imagem serve aos três.
3. **Tamanho por família**, pensado para a maior exibição em tela de 3x: cena 960 px de largura, estado e objeto 640 px, símbolo 96 px.
4. **Nem toda peça vira máscara.** A lista fica no gerador. A cena `cheguei` com fundo talhado fica de fora (é a mais pesada e tem a versão `cheguei-miniatura`).
5. **Limite de peso por máscara** conferido em teste: cena 120 kB, estado e objeto 60 kB, símbolo 4 kB. O teste também confere que toda máscara tem SVG de origem no manifesto.
6. **Um componente só, `Xilo`**, no app: recebe o nome da peça e, se a peça informa algo, usa o texto alternativo do manifesto; se é enfeite (`decorativa`), fica fora do leitor de tela.
7. As máscaras são arquivos gerados e versionados; quem muda um SVG roda o gerador, e o teste acusa máscara desatualizada pelo carimbo do SVG guardado ao lado.

## Alternativas descartadas

- **`react-native-svg`.** Resolve com fidelidade vetorial, mas é biblioteca nativa nova, com código de terceiros no caminho de toda tela, para desenhar figuras que não mudam em tempo de execução.
- **`expo-image` com SVG.** Também é dependência nova, e a troca de cor por tema em SVG com `currentColor` não é garantida nas três plataformas.
- **Um PNG por tema.** Triplica o peso e engessa a paleta: cor nova no tema exigiria gerar tudo de novo.
- **Desenhar com `View`, como o QR.** Serve para uma grade de quadrados, não para traço de gravura.
- **Fonte de ícones.** Só cobriria os símbolos e criaria um segundo jeito de fazer a mesma coisa.

## Consequências

- A gravura deixa de ser vetorial no app: ampliar além do tamanho gerado borra. Os tamanhos foram escolhidos com folga para celular e tablet; na área web grande, a cena fica limitada a 480 px de largura.
- O pacote do app cresce o peso somado das máscaras (o teste imprime o total).
- A máscara é de uma cor só, como a gravura. Duas tintas na mesma peça exigiriam duas máscaras sobrepostas.
- Na web o SVG poderia ser usado direto, mas o mesmo componente e a mesma máscara valem para as três plataformas, para a tela ser igual em todas.
