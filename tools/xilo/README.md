# tools/xilo

Gerador da [carteira de xilos](../../packages/xilos). Não faz parte do app nem do `npm run verify`: roda à mão quando uma gravura nova entra.

- `gramatica.py`: a Gramática da Xilo como biblioteca (Perlin, goiva, deformação de borda, limpeza, falha de tinta, vetorização em um traçado).
- `pecas.py`: uma receita por peça.
- `gerar.py`: gera os SVGs em `packages/xilos/svg` e a folha de contato em `saida/`.
- `cheguei/`: os scripts originais da cena "Cheguei" (`compose.py`, `xilo.py`, `vetorizar.py`), guardados como origem da gramática.
