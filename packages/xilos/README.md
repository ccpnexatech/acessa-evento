# Carteira de xilos

As gravuras do Acessa Evento. Arte generativa inspirada na xilogravura nordestina, **escrita em código**: nada é entalhado à mão, nenhuma imagem de terceiros é lida e nenhuma IA geradora de imagem é usada.

Cada arquivo em `svg/` é um único traçado em `currentColor`. A gravura herda a cor do texto, então acompanha os temas claro, escuro e alto contraste sem versão extra.

## Peças

| Peça | Família | Onde entra |
| --- | --- | --- |
| `cheguei.svg` | cena | Check-in confirmado e abertura do app, com fundo talhado |
| `cheguei-miniatura.svg` | cena | A mesma cena em traço limpo, para tamanhos pequenos |
| `nada-por-aqui.svg` | estado | Telas vazias |
| `sem-internet.svg` | estado | Aviso de que o app está sem internet |
| `algo-deu-errado.svg` | estado | Erros |
| `tudo-pronto.svg` | estado | Confirmações |
| `ingresso.svg` | objeto | Confirmação de inscrição e verso do bilhete |
| `faixa-bandeirolas.svg` | objeto | Divisória entre blocos |
| `simbolo-libras.svg` | símbolo | Selo de Libras |
| `simbolo-ingresso.svg` | símbolo | Aba Ingresso |
| `simbolo-legenda.svg` | símbolo | Selo de legenda |
| `simbolo-audiodescricao.svg` | símbolo | Selo de audiodescrição |
| `simbolo-sem-degraus.svg` | símbolo | Acesso sem degraus |
| `simbolo-favorito.svg` | símbolo | Favoritar sessão |
| `simbolo-aviso.svg` | símbolo | Avisos e permissão de notificações |
| `simbolo-mapa.svg` | símbolo | Local, salas e estandes |
| `simbolo-camera.svg` | símbolo | Permissão da câmera e leitor de QR |
| `simbolo-privacidade.svg` | símbolo | Privacidade e dados |

O uso e o texto alternativo de cada uma estão em [`src/index.ts`](src/index.ts).

## Regras

O teste [`src/xilos.test.ts`](src/xilos.test.ts) roda no `npm run verify` e barra a peça que quebrar uma delas.

- **Uma tinta só.** Um `<path>` com `fill="currentColor"`. Nenhuma cor fixa.
- **Sem tamanho fixo.** Só `viewBox`; quem define o tamanho é a tela.
- **Peso.** Cena até 150 KB, estado e objeto até 45 KB, símbolo até 4 KB.
- **Texto alternativo.** Toda peça tem. O arquivo vem com `aria-hidden="true"`; a tela que usa a gravura para informar algo expõe o `alt` do manifesto.
- **Nunca atrás de texto.** Gravura é figura, não fundo.
- **Símbolo anda com palavra.** Ícone nunca é o único sinal.

## Como gerar

O gerador fica em [`tools/xilo`](../../tools/xilo). Precisa de Python 3 com `numpy`, `scipy`, `pillow`, `cairosvg` e `potracer`.

```bash
python3 tools/xilo/gerar.py                 # todas as peças do lote
python3 tools/xilo/gerar.py sem-internet    # só uma
```

A semente é fixa (2026): rodar de novo produz os mesmos arquivos, byte a byte. A folha de contato para conferir o resultado sai em `tools/xilo/saida/`, fora do git.

Para criar uma peça: escreva a receita em `tools/xilo/pecas.py` (desenho em SVG, mais traços e cortes de goiva), gere, olhe a folha de contato nos dois temas e em tamanho pequeno, ajuste e repita. Depois registre a peça em `src/index.ts`.

## Origem e licenças

- **Cheguei:** figuras do [Open Peeps](https://www.openpeeps.com/) de Pablo Stanley (CC0 1.0), via `react-peeps` 0.1.10 (MIT). Cenário, moldura, roda da cadeira e o efeito de xilo são desenho próprio em código. Os três scripts originais estão em `tools/xilo/cheguei/`; para rodar o `compose.py` faltam as figuras exportadas em `render/figs/`, que não estão no repositório.
- **Demais peças:** desenho próprio em código, com a mesma gramática (ruído de borda de madeira, goiva afilada, falha de tinta), em `tools/xilo/gramatica.py`.
