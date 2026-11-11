"""vetorizar.py — Etapa 5/6: PNG binário (xilo.py) → SVG de uma tinta (fill="currentColor") via potrace CLI.

Uso: python3 vetorizar.py
Entradas: xilo-1x1.png (peça "cheia"), xilo-1x1-miniatura.png (peça "miniatura"), 4096 px, 1 bit.
Saídas: cheguei-1x1.svg, cheguei-9x16.svg, cheguei-miniatura-1x1.svg, cheguei-miniatura-9x16.svg,
        relatorio-etapa5.json.
"""
import json, re, subprocess, os, io, datetime
import numpy as np
from PIL import Image
import cairosvg

VERSAO_SCRIPT = "xilo.py 0.5.0 / vetorizar.py 1.0.0"
SEED = 2026
META_KB = 150

# Parâmetros do potrace (tentados em ordem até ficar abaixo da meta; o primeiro que cabe é usado)
#   res: lado do bitmap vetorizado (px) · turd: elimina manchas < turd px² · alpha: suavidade dos cantos
#   (menor = mais quinas, mais "corte") · opt: tolerância da otimização de curvas (maior = menos nós)
TENTATIVAS = [
    dict(res=4096, turd=40, alpha=0.9, opt=0.4),
    dict(res=3072, turd=24, alpha=0.9, opt=0.5),
    dict(res=2048, turd=12, alpha=0.9, opt=0.6),
    dict(res=2048, turd=20, alpha=0.8, opt=1.0),
    dict(res=1536, turd=12, alpha=0.8, opt=1.0),
    dict(res=1280, turd=10, alpha=0.8, opt=1.0),
    dict(res=1024, turd=8, alpha=0.8, opt=1.0),
]

PECAS = {"cheia": ("xilo-1x1.png", "cheguei"), "miniatura": ("xilo-1x1-miniatura.png", "cheguei-miniatura")}


def tracar(png, p, tmp="tmp.pbm"):
    im = Image.open(png).convert("L")
    if im.width != p["res"]:
        im = im.resize((p["res"], p["res"]), Image.LANCZOS)
    (im.point(lambda v: 255 if v >= 128 else 0).convert("1")).save(tmp)       # limiar 1 bit
    out = subprocess.run(["potrace", tmp, "-s", "--flat", "-u", "1", "-t", str(p["turd"]), "-a", str(p["alpha"]),
                          "-O", str(p["opt"]), "-o", "-"], capture_output=True, text=True, check=True).stdout
    d = " ".join(re.findall(r'<path d="([^"]+)"', out))
    d = re.sub(r"\s+", " ", d).replace(" -", "-")         # compacta espaços (sem alterar a geometria)
    tr = re.search(r'<g transform="([^"]+)"', out).group(1)
    return d, tr


def montar(d, tr, res, titulo, peca, p, alt=1.0):
    """SVG final: um <path>, currentColor, viewBox sem width/height. alt = altura / largura."""
    data = datetime.date(2026, 11, 2).isoformat()
    com = (f"<!-- {titulo} | peça: {peca} | seed {SEED} | {VERSAO_SCRIPT} | potrace res={res} t={p['turd']} "
           f"a={p['alpha']} O={p['opt']} | Figuras: Open Peeps, Pablo Stanley, CC0 1.0 (via react-peeps 0.1.10, MIT); "
           f"cenário, moldura, roda da cadeira e efeito: desenho próprio em código (CCP NEXATECH) | "
           f"arte generativa inspirada na xilogravura nordestina, escrita em código | {data} -->")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {res} {round(res * alt)}" aria-hidden="true" focusable="false">'
            f'{com}<path fill="currentColor" transform="{tr}" d="{d}"/></svg>')


def comparar(png, svg_txt, nome):
    """PNG × SVG lado a lado: 100% (1024 px) e 400% (recorte de 256 px ampliado)."""
    a = Image.open(png).convert("L").resize((1024, 1024), Image.LANCZOS)
    b = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg_txt.replace("currentColor", "#000").encode(),
                                               output_width=1024, output_height=1024, background_color="white"))).convert("L")
    A, B = np.array(a) < 128, np.array(b) < 128
    iou = float((A & B).sum() / max(1, (A | B).sum()))
    box = (560, 300, 816, 556)                       # mão e rosto da cadeirante
    S = Image.new("L", (2068, 2072), 255)
    S.paste(a, (0, 0)); S.paste(b, (1044, 0))
    S.paste(a.crop(box).resize((1024, 1024), Image.NEAREST), (0, 1048))
    S.paste(b.crop(box).resize((1024, 1024), Image.NEAREST), (1044, 1048))
    S.save(f"comparacao-png-svg-{nome}.png")
    return round(iou, 4)


if __name__ == "__main__":
    rel = {}
    for peca, (png, base) in PECAS.items():
        for p in TENTATIVAS:
            d, tr = tracar(png, p)
            svg = montar(d, tr, p["res"], 'Cartão "Cheguei" — COCAL 2026, 1:1', peca, p)
            kb = len(svg.encode()) / 1024
            if kb < META_KB: break
        svg916 = montar(d, tr, p["res"], 'Cartão "Cheguei" — COCAL 2026, 9:16 (arte no topo, área de texto livre)',
                        peca, p, alt=1920 / 1080)
        open(f"{base}-1x1.svg", "w").write(svg)
        open(f"{base}-9x16.svg", "w").write(svg916)
        subcaminhos = d.count("M") + d.count("m")
        nos = len(re.findall(r"[-\d.]+[ ,][-\d.]+", d))
        rel[peca] = dict(parametros=p, kb_1x1=round(kb, 1), kb_9x16=round(len(svg916.encode()) / 1024, 1),
                         elementos_path=svg.count("<path"), subcaminhos=subcaminhos, nos_aprox=nos,
                         iou_png_svg=comparar(png, svg, peca), cabe_na_meta=kb < META_KB)
    json.dump(rel, open("relatorio-etapa5.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(rel, ensure_ascii=False, indent=1))
