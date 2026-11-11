"""compose.py — Etapa 2 (v2): composição limpa do cartão "Cheguei", antes do efeito de xilo.

Saídas: composicao-1x1.svg/.png, composicao-9x16.svg/.png, relatório de folgas e cobertura.
Camadas SVG: <g id="cenario">, <g id="figuras">, <g id="moldura">.

Origem dos elementos:
  - figuras: Open Peeps (Pablo Stanley, CC0 1.0) via react-peeps 0.1.10 (código MIT);
    convertidas em silhuetas fechadas (potrace) depois de: engrossar traços, simplificar
    detalhes, preencher roupas de preto e redesenhar a roda grande da cadeira (desenho próprio).
  - entrada, faixa, bandeirolas, chão e moldura: desenho próprio, neste arquivo.
Determinístico: SEED fixa. Nenhuma imagem de terceiros é lida.
"""
import io, math, json
import numpy as np
import cairosvg, potrace
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, disk, binary_dilation, binary_opening, remove_small_holes

SEED = 2026
FIG_DIR = "render/figs"
LPX = 2048            # resolução de trabalho: lado maior da tela, em px
MIN_TRACO = 0.0045    # espessura mínima de traço (fração de L)
FOLGA = 0.015         # distância mínima entre elementos diferentes (fração de L)
DETALHE = 0.012       # buracos brancos menores que (DETALHE·L)² são fechados (cadarços, dobras)

# Ordem = da esquerda para a direita; todas olham e andam para a direita (nenhuma espelhada).
# "preencher": sementes (x, y normalizados no recorte) de áreas brancas que viram preto (massa).
FIGURAS = [
    {"id": "andando_wb", "preencher": [], "cabeca": 0.19},                                  # camisa branca, calça preta
    {"id": "cadeirante", "preencher": [(0.72, 0.67), (0.62, 0.55)], "cabeca": 0.24,         # calça preta
     "roda": {"cx": 0.178, "cy": 0.736, "rx": 0.172, "ry": 0.213, "aro": 0.20, "raios": 5}},
    {"id": "andando_bw", "preencher": [(0.73, 0.68), (0.30, 0.66), (0.46, 0.80)], "cabeca": 0.21},  # camisa e calça pretas
]

GRID_W = 1600  # largura de rasterização usada para medir as coordenadas normalizadas


def raster_figura(fid, escala_px):
    """Rasteriza a figura; escala_px = px de saída por px da grade de referência."""
    s = open(f"{FIG_DIR}/{fid}.svg").read()
    s = s[s.index("<svg"):s.rindex("</svg>") + 6]
    w = int(GRID_W * escala_px); h = int(1700 * escala_px)
    im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(), output_width=w, output_height=h, background_color="white"))).convert("L")
    a = np.array(im) < 128
    ys, xs = np.where(a)
    return np.pad(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 24)


def tratar_figura(cfg, escala_px, L):
    a = raster_figura(cfg["id"], escala_px)
    H, W = a.shape
    minw = MIN_TRACO * L
    # 1) massas: preenche roupas indicadas
    lab, _ = ndi.label(~a)
    for (u, v) in cfg["preencher"]:
        k = lab[int(v * H), int(u * W)]
        if k and (lab == k).sum() < 0.2 * a.size:
            a |= lab == k
    # 2) roda grande redesenhada em código: aro grosso, 5 raios, cubo
    if "roda" in cfg:
        r = cfg["roda"]; cx, cy, rx, ry = r["cx"] * W, r["cy"] * H, r["rx"] * W, r["ry"] * H
        yy, xx = np.mgrid[0:H, 0:W]
        e = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        ri = 1 - r["aro"]
        interior = e < ri ** 2
        assento = yy < cy - ry * 0.45            # preserva almofada e mão acima do cubo
        a[interior & ~assento] = False
        a[(e <= 1) & (e >= ri ** 2)] = True      # aro
        img = Image.fromarray(a); d = ImageDraw.Draw(img)
        lw = max(int(minw * 1.3), 3)
        for i in range(r["raios"]):
            t = math.radians(90 + i * 360 / r["raios"])
            d.line([(cx, cy), (cx + rx * ri * math.cos(t), cy + ry * ri * math.sin(t))], fill=True, width=lw)
        d.ellipse([cx - lw * 1.4, cy - lw * 1.4, cx + lw * 1.4, cy + lw * 1.4], fill=True)
        a = np.array(img.convert("L")) > 0
    # 3) espessura mínima: todo esqueleto vira traço de pelo menos minw
    rad = max(1, int(math.ceil(minw / 2)))
    a = a | binary_dilation(skeletonize(np.ascontiguousarray(a)), disk(rad))
    # 4) simplificação: fecha frestas brancas finas e buracos pequenos (cadarços, dobras)
    #    (a cabeça fica de fora: o rosto será decidido no Ponto 3, variações A/B)
    cab = int(cfg.get("cabeca", 0.2) * a.shape[0])
    branco = binary_opening(~a, disk(max(1, rad - 1)))
    simpl = remove_small_holes(~branco, area_threshold=int((DETALHE * L) ** 2))
    a[cab:] = simpl[cab:]
    return a


def tracar(mask, ox=0.0, oy=0.0, turdsize=8):
    """Silhuetas fechadas via potrace. Retorna o atributo d."""
    p = potrace.Bitmap(~mask).trace(turdsize=turdsize, alphamax=1.0, opticurve=True, opttolerance=0.3)
    d = []
    for c in p.curves:
        s = c.start_point; d.append(f"M{s.x+ox:.1f},{s.y+oy:.1f}")
        for g in c.segments:
            if g.is_corner:
                d.append(f"L{g.c.x+ox:.1f},{g.c.y+oy:.1f}L{g.end_point.x+ox:.1f},{g.end_point.y+oy:.1f}")
            else:
                d.append(f"C{g.c1.x+ox:.1f},{g.c1.y+oy:.1f} {g.c2.x+ox:.1f},{g.c2.y+oy:.1f} {g.end_point.x+ox:.1f},{g.end_point.y+oy:.1f}")
        d.append("Z")
    return "".join(d)


def empacotar(masks, folga):
    """Desliza cada figura para a esquerda até ficar a 'folga' px da anterior (pela forma, não pela caixa)."""
    xs = [0]; Hs = max(m.shape[0] for m in masks)
    canvas_w = int(sum(m.shape[1] for m in masks) + folga * len(masks) * 2)
    occ = np.zeros((Hs, canvas_w), bool)
    def stamp(m, x):
        o = np.zeros_like(occ); o[Hs - m.shape[0]:, x:x + m.shape[1]] = m; return o
    occ |= stamp(masks[0], 0)
    for m in masks[1:]:
        dist = ndi.distance_transform_edt(~occ)
        x = 0
        while True:
            o = stamp(m, x)
            if dist[o].min() >= folga: break
            x += 2
        xs.append(x); occ |= o
    return xs, occ


def svg_render(svg, w, h):
    return np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=w, output_height=h, background_color="white"))).convert("L")) < 128


def bandeirolas(x0, x1, y, flecha, n, rng, tam, sw):
    pts = [(x0 + (x1 - x0) * i / 40, y + flecha * 4 * (i / 40) * (1 - i / 40)) for i in range(41)]
    out = [f'<path d="M{" L".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="none" stroke="#000" stroke-width="{sw:.1f}"/>']
    fundo = y
    for i in range(n):
        t = (i + 0.5) / n
        cx, cy = x0 + (x1 - x0) * t, y + flecha * 4 * t * (1 - t)
        w = tam * rng.uniform(0.85, 1.1); h = tam * rng.uniform(1.1, 1.35); ang = rng.uniform(-5, 5)
        out.append(f'<path transform="rotate({ang:.1f} {cx:.1f} {cy:.1f})" d="M{cx-w/2:.1f},{cy:.1f}L{cx+w/2:.1f},{cy:.1f}L{cx:.1f},{cy+h:.1f}Z" '
                   f'fill="{"#000" if i % 2 else "#fff"}" stroke="#000" stroke-width="{sw:.1f}" stroke-linejoin="round"/>')
        fundo = max(fundo, cy + h * 1.03)
    return "".join(out), fundo


def cena(nome, Wf, Hf, Af):
    rng = np.random.default_rng(SEED)
    k = LPX / max(Wf, Hf)                        # px de trabalho por unidade final
    W, H, A = round(Wf * k), round(Hf * k), round(Af * k)
    L = max(W, H); g = FOLGA * L; minw = MIN_TRACO * L
    m, t = 0.035 * W, 0.018 * W                  # margem e espessura da moldura
    pw = 0.035 * W                               # largura do poste
    px0 = m + g; px1 = W - m - g - pw            # postes a uma folga da moldura
    vao0, vao1 = px0 + pw + g, px1 - g           # vão livre para as figuras

    # --- figuras: maior escala que cabe no vão, empacotadas pela forma ---
    lo, hi = 0.2, 2.0
    for _ in range(9):
        s = (lo + hi) / 2
        masks = [tratar_figura(c, s, L) for c in FIGURAS]
        xs, occ = empacotar(masks, g)
        larg = xs[-1] + masks[-1].shape[1]
        lo, hi = (s, hi) if larg <= vao1 - vao0 else (lo, s)
    masks = [tratar_figura(c, lo, L) for c in FIGURAS]
    xs, occ = empacotar(masks, g)
    larg = xs[-1] + masks[-1].shape[1]; Hfig = occ.shape[0]

    # --- vertical, de cima para baixo: céu curto, faixa, bandeirolas, folga, figuras, chão ---
    ceu = 0.05 * A
    fa_y = m + g + ceu; fa_h = 0.0375 * A; arco = 0.012 * A     # faixa com metade da altura anterior
    sw = minw
    fileiras = 2 if A <= W else 3
    bs, f = [], fa_y + fa_h + arco + 0.004 * A
    for i in range(fileiras):
        b, f = bandeirolas(px0 + pw, px1, f + 0.004 * A, (0.035 - 0.004 * i) * A / (1 if fileiras == 2 else 1.3),
                           11 + 2 * i, rng, (0.034 - 0.004 * i) * W, sw)
        bs.append(b)
    b1, b2, f2 = "".join(bs), "", f
    topo_fig = f2 + g
    chao = topo_fig + Hfig - 0.006 * A          # pés pousados levemente no chão
    x0 = vao0 + ((vao1 - vao0) - larg) / 2

    cen = ['<g id="cenario">',
           # chão invade a moldura em 2 px para não sobrar fresta branca
           f'<rect x="{m-2:.1f}" y="{chao:.1f}" width="{W-2*m+4:.1f}" height="{A-m-chao+2:.1f}" fill="#000"/>',
           f'<rect x="{px0:.1f}" y="{fa_y:.1f}" width="{pw:.1f}" height="{chao-fa_y:.1f}" fill="#000"/>',
           f'<rect x="{px1:.1f}" y="{fa_y:.1f}" width="{pw:.1f}" height="{chao-fa_y:.1f}" fill="#000"/>',
           # faixa: tira preta curva, baixa, pronta para receber entalhes na Etapa 3
           f'<path id="faixa" d="M{px0-g*0.3:.1f},{fa_y+arco:.1f} Q{W/2:.1f},{fa_y-arco:.1f} {px1+pw+g*0.3:.1f},{fa_y+arco:.1f} '
           f'L{px1+pw+g*0.3:.1f},{fa_y+arco+fa_h:.1f} Q{W/2:.1f},{fa_y-arco+fa_h:.1f} {px0-g*0.3:.1f},{fa_y+arco+fa_h:.1f}Z" fill="#000"/>',
           b1, b2, '</g>']
    fig_svg = ['<g id="figuras">']
    fig_layers = []
    for c, mk, x in zip(FIGURAS, masks, xs):
        ox, oy = x0 + x, chao + 0.006 * A - mk.shape[0]
        fig_svg.append(f'<path id="fig-{c["id"]}" fill="#000" fill-rule="evenodd" d="{tracar(mk, ox, oy)}"/>')
        lay = np.zeros((H, W), bool); yi, xi = int(round(oy)), int(round(ox))
        lay[yi:yi + mk.shape[0], xi:xi + mk.shape[1]] = mk; fig_layers.append(lay)
    fig_svg.append('</g>')
    mold = (f'<g id="moldura"><path fill-rule="evenodd" fill="#000" d="M{m-t:.1f},{m-t:.1f}H{W-m+t:.1f}V{A-m+t:.1f}H{m-t:.1f}Z '
            f'M{m:.1f},{m:.1f}V{A-m:.1f}H{W-m:.1f}V{m:.1f}Z"/></g>')

    def doc(*partes, fundo=True):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wf} {Hf}"><g transform="scale({1/k:.6f})">'
                + (f'<rect width="{W}" height="{H}" fill="#fff"/>' if fundo else "") + "".join(partes) + "</g></svg>")

    svg = doc(*cen, *fig_svg, mold)
    # --- verificação de folgas (por camada rasterizada) ---
    camadas = {
        "moldura": svg_render(doc(mold), W, H),
        "postes+faixa": svg_render(doc(*cen[2:5]), W, H),
        "bandeirolas": svg_render(doc(b1, b2), W, H),
    }
    rel = {}
    for i, (c, lay) in enumerate(zip(FIGURAS, fig_layers)):
        dist = ndi.distance_transform_edt(~lay)
        for nm, cm in camadas.items():
            rel[f'{c["id"]} ↔ {nm}'] = round(float(dist[cm].min()) / L * 100, 2)
        for j in range(i + 1, len(fig_layers)):
            rel[f'{c["id"]} ↔ {FIGURAS[j]["id"]}'] = round(float(dist[fig_layers[j]].min()) / L * 100, 2)
    full = svg_render(svg, W, H)
    arte = full[:A]
    preto = arte.mean()
    # fundo reservado para hachura: branco fora das figuras, dentro da moldura, acima do chão
    inside = np.zeros_like(arte); inside[int(m):int(chao), int(m):int(W - m)] = True
    figs_all = np.any([ndi.binary_fill_holes(l) for l in fig_layers], axis=0)[:A]
    fundo = inside & ~arte & ~ndi.binary_dilation(figs_all, iterations=3)
    figs_branco = figs_all & ~arte
    cobertura = {
        "preto_agora_%": round(preto * 100, 1),
        "fundo_reservado_para_hachura_%": round(fundo.mean() * 100, 1),
        "branco_dentro_das_figuras_%": round(figs_branco.mean() * 100, 1),
        "previsao_pos_efeito_%": round((preto * 0.92 + fundo.mean() * 0.40 + figs_branco.mean() * 0.15) * 100, 1),
        "altura_figura_em_pe_%W": round(Hfig / W * 100, 1),
    }
    return svg, rel, cobertura


if __name__ == "__main__":
    relatorio = {}
    for nome, (Wf, Hf, Af) in {"1x1": (1024, 1024, 1024), "9x16": (1080, 1920, 1280)}.items():
        svg, rel, cob = cena(nome, Wf, Hf, Af)
        open(f"composicao-{nome}.svg", "w").write(svg)
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f"composicao-{nome}.png", output_width=Wf, output_height=Hf, background_color="white")
        relatorio[nome] = {"folgas_%L (min 1.5)": rel, "cobertura": cob}
    json.dump(relatorio, open("relatorio-etapa2.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(relatorio, ensure_ascii=False, indent=1))
