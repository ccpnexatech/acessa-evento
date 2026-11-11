"""gerar.py — gera a carteira, grava os SVGs em packages/xilos/svg e monta a folha de contato para validação.

Uso: python3 tools/xilo/gerar.py [nome-da-peca ...]
"""
import io
import json
import os
import sys
import time
import cairosvg
from PIL import Image, ImageDraw
import gramatica as G
import pecas as P

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "..", "packages", "xilos", "svg")      # SVGs versionados
RASCUNHO = os.path.join(AQUI, "saida")                                  # folha de contato e relatório (fora do git)
os.makedirs(RASCUNHO, exist_ok=True)
VERSAO = "xilo 0.6.0 (gramatica.py, potracer)"
so = sys.argv[1:]  # nomes para regerar; vazio = todos

rel = json.load(open(os.path.join(RASCUNHO, "relatorio.json"))) if os.path.exists(os.path.join(RASCUNHO, "relatorio.json")) else {}
for nome, (fn, largura, alt) in P.LOTE1.items():
    if so and nome not in so: continue
    t = time.time()
    img = G.gravar(fn())
    d, w, h = G.vetorizar(img, largura)
    svg = G.montar(d, w, h, f"{alt} | carteira de xilos, Acessa Evento | seed 2026 | {VERSAO} | desenho próprio em código (CCP NEXATECH)")
    open(os.path.join(SAIDA, nome + ".svg"), "w").write(svg)
    rel[nome] = dict(kb=round(len(svg.encode()) / 1024, 1), preto_pct=round(float(img.mean()) * 100, 1), alt=alt, s=round(time.time() - t, 1))
for nome, (fn, alt) in P.SIMBOLOS.items():
    if so and nome not in so: continue
    svg = fn(); open(os.path.join(SAIDA, nome + ".svg"), "w").write(svg)
    rel[nome] = dict(kb=round(len(svg.encode()) / 1024, 2), alt=alt)
json.dump(rel, open(os.path.join(RASCUNHO, "relatorio.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(rel, ensure_ascii=False))


def png(svg, cor, fundo, larg):
    b = cairosvg.svg2png(bytestring=svg.replace("currentColor", cor).encode(), output_width=larg, background_color=fundo)
    return Image.open(io.BytesIO(b)).convert("RGB")


# folha de contato: cada peça em tamanho grande (claro e escuro) e pequena
TEMAS = [("#12201e", "#ffffff"), ("#eef4f3", "#0e1615")]
nomes = list(P.LOTE1) + list(P.SIMBOLOS)
folha = Image.new("RGB", (1700, 40 + 470 * len(P.LOTE1) + 200), "#cfd6d4")
d = ImageDraw.Draw(folha); y = 20
for nome in P.LOTE1:
    svg = open(os.path.join(SAIDA, nome + ".svg")).read()
    x = 20
    for cor, fundo in TEMAS:
        im = png(svg, cor, fundo, 640 if "faixa" in nome else 440)
        folha.paste(im, (x, y)); x += im.width + 20
    for larg in (120, 48):
        im = png(svg, *TEMAS[0], larg); folha.paste(im, (x, y)); x += larg + 20
    d.text((x, y), f"{nome}  {rel[nome]['kb']} KB", fill="#000")
    y += 470 if "faixa" not in nome else 130
x = 20
for nome in P.SIMBOLOS:
    svg = open(os.path.join(SAIDA, nome + ".svg")).read()
    for larg in (160, 48, 24):
        for cor, fundo in TEMAS:
            im = png(svg, cor, fundo, larg); folha.paste(im, (x, y)); x += larg + 10
    x += 30
folha = folha.crop((0, 0, 1700, y + 180))
folha.save(os.path.join(RASCUNHO, "folha-de-contato.png"))
