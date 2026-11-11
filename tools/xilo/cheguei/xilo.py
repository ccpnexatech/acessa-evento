"""xilo.py — Etapa 3/4: aplica a Gramática da Xilo à composição aprovada e renderiza em 1 bit.

Arte generativa inspirada na xilogravura nordestina, escrita em código. Nada aqui é entalhado à mão,
nenhuma imagem de terceiros é lida e nenhuma IA geradora de imagem é usada.

Entrada: compose.cena() (figuras Open Peeps CC0 + cenário próprio), reconstruída em alta resolução.
Saídas: xilo-1x1-rostoA.png, xilo-1x1-rostoB.png (4096 px, binário), comparacao-etapa3.png,
        relatorio-etapa3.json.
Versão: 0.3.0
"""
# =====================================================================================
# CONFIGURAÇÃO — todas as medidas são frações de L (lado maior, 4096 px) ou de H (figura em pé)
# =====================================================================================
CFG = dict(
    SEED=2026,                 # semente única: ruído, hachuras, cunhas, falhas
    L_PX=4096,                 # resolução de render (Etapa 4)
    # regra 5 — meta de cobertura
    META_PRETO=0.55,           # fração de preto alvo na arte (±0,05)
    # regra 2 — contorno externo das figuras (somado ao traço do Peep)
    CONTORNO_H=0.014,          # espessura base, fração de H
    CONTORNO_VAR=0.25,         # variação ±25% por ruído
    RESPIRO_L=0.008,           # faixa branca entre figura e hachura do fundo (fração de L)
    # regra 3 — borda de madeira (deslocamento por Perlin) — total ≤ 0,3% de L
    PERLIN_AMP_L=0.0024, PERLIN_ONDA_L=0.012,
    TREMOR_AMP_L=0.0005, TREMOR_ONDA_L=0.003,
    AMP_PROTEGIDA=0.35,        # fator do deslocamento em rostos e cadeira de rodas
    # massas pretas controladas (pedido do Ponto 2) — só roupas e cabelo
    MASSA_FECHAMENTO_H=0.012,  # raio do fechamento morfológico que funde traços em massa
    # regra 6 — hachura
    HACH_ESPACO_L=0.009, HACH_LARG_L=0.0042,  # fundo: espaçamento e largura máxima (afina nas pontas)
    HACH_TRECHO_L=(0.05, 0.20), HACH_PAUSA_L=(0.004, 0.015),   # comprimento dos traços e das pausas
    HACH_ONDULA_L=0.0025,      # ondulação vertical das linhas do fundo
    HACH_ROUPA_ESPACO_L=0.011, HACH_ROUPA_LARG_L=0.0032,       # sombra nas roupas brancas
    HACH_ROUPA_AREA_H=0.08,    # só hachura regiões brancas maiores que (x·H)²
    # regra 7 — cunhas de luz (luz no alto à esquerda)
    LUZ=(-1.0, -1.0),
    CUNHA_COMP_L=(0.025, 0.05), CUNHA_LARG_L=0.006, CUNHA_PASSO_L=0.016, CUNHA_DESVIO_GRAUS=10,
    LIMPEZA_L=0.0013,          # remove frestas brancas e pingos pretos menores que ~2× este raio (sem fios de cabelo)
    CUNHA_MASSA_H=0.09,        # só em massas maiores que (x·H)²
    # regra 8 — raios no céu: desligado (Ponto 1)
    RAIOS=False,
    # regra 9 — chão com goiva U (cortes brancos)
    CHAO_LARG_L=0.005, CHAO_COMP_L=(0.02, 0.10), CHAO_ESPACO_L=(0.010, 0.020), CHAO_RESPIRO_L=0.015,
    # faixa da entrada: entalhe em zigue-zague
    FAIXA_PASSO_L=0.026,
    # regra 10 — rosto B: olhos em ponto/traço e boca simples
    ROSTO_B_TRACO_L=0.006,
    # regra 12 — moldura
    MOLD_CANTO_L=0.008, MOLD_RUIDO_FATOR=1.5, MOLD_FALHAS=(1, 2), MOLD_FALHA_L=(0.005, 0.015),
    # regra 13 — falha de tinta
    FALHA_MASSA_MIN=0.03,      # só em massas pretas contínuas > 3% da tela
    FALHA_RAIO_L=(0.0012, 0.003), FALHA_DENSIDADE=0.008,
    TURDSIZE=40,               # potrace (Etapa 5); toda mancha tem área > TURDSIZE px²
)
# =====================================================================================

import io, json, math, sys
import numpy as np
import cairosvg
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
import compose

RNG = np.random.default_rng(CFG["SEED"])


def perlin(shape, onda, rng, oitavas=2):
    """Ruído de Perlin próprio (gradientes aleatórios em grade), em [-1, 1] aprox."""
    H, W = shape
    out = np.zeros(shape, np.float32); amp = 1.0; tot = 0
    for o in range(oitavas):
        cell = max(4, onda / (2 ** o))
        gh, gw = int(H / cell) + 2, int(W / cell) + 2
        ang = rng.uniform(0, 2 * np.pi, (gh, gw)); gx, gy = np.cos(ang), np.sin(ang)
        ys = np.arange(H) / cell; xs = np.arange(W) / cell
        y0 = ys.astype(int); x0 = xs.astype(int); fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
        def dot(dy, dx):
            return gx[(y0 + dy)[:, None], (x0 + dx)[None, :]] * (fx - dx) + gy[(y0 + dy)[:, None], (x0 + dx)[None, :]] * (fy - dy)
        fade = lambda t: t * t * t * (t * (t * 6 - 15) + 10)
        u, v = fade(fx), fade(fy)
        n = (dot(0, 0) * (1 - u) + dot(0, 1) * u) * (1 - v) + (dot(1, 0) * (1 - u) + dot(1, 1) * u) * v
        out += amp * n; tot += amp; amp *= 0.5
    return out / tot * 1.6


def disco(r):
    r = max(1, int(round(r))); y, x = np.ogrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r


def render(svg, W, H):
    return np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=W, output_height=H,
                                                            background_color="white"))).convert("L")) < 128


def stroke_afilado(d, pts, larg, ponta="v"):
    """Traço de goiva: largura máxima no meio, afinando para as pontas (V) ou constante com pontas redondas (U)."""
    n = len(pts)
    if n < 2: return
    esq, dir_ = [], []
    for i, (x, y) in enumerate(pts):
        t = i / (n - 1)
        w = larg * (math.sin(math.pi * t) ** 0.6 if ponta == "v" else 1.0) / 2
        x2, y2 = pts[min(i + 1, n - 1)]; x1, y1 = pts[max(i - 1, 0)]
        dx, dy = x2 - x1, y2 - y1; nrm = math.hypot(dx, dy) or 1
        nx, ny = -dy / nrm, dx / nrm
        esq.append((x + nx * w, y + ny * w)); dir_.append((x - nx * w, y - ny * w))
    d.polygon(esq + dir_[::-1], fill=255)
    if ponta == "u":
        for (x, y) in (pts[0], pts[-1]):
            d.ellipse([x - larg / 2, y - larg / 2, x + larg / 2, y + larg / 2], fill=255)


def mascara_de(desenho_fn, shape):
    im = Image.new("L", (shape[1], shape[0]), 0); desenho_fn(ImageDraw.Draw(im)); return np.array(im) > 127


def preparar():
    """Reconstrói a composição aprovada em 4096 px e devolve camadas e metadados."""
    svg, rel, cob, I = compose.cena("1x1", 1024, 1024, 1024, lpx=CFG["L_PX"], com_info=True)
    W, H = I["W"], I["H"]
    base = render(svg, W, H)
    I["base"] = base
    I["cenario"] = render(I["doc"](I["svg_cenario"]), W, H)
    I["bandeirolas"] = render(I["doc"](I["svg_bandeirolas"]), W, H)
    I["moldura_orig"] = render(I["doc"](I["svg_moldura"]), W, H)
    Hpe = I["Hpe"]
    rosto, cadeira, roupa = (np.zeros((H, W), bool) for _ in range(3))
    sil_all = np.zeros((H, W), bool)
    for f in I["figuras"]:
        ink = f["layer"]
        sil = ndi.binary_fill_holes(ndi.binary_closing(ink, structure=disco(0.012 * Hpe))) | ink   # fecha frestas (orelha) antes de preencher
        f["sil"] = sil; sil_all |= sil
        mh, mw = f["mask"].shape; oy, ox = int(round(f["oy"])), int(round(f["ox"]))
        cab = np.zeros_like(sil); cab[oy:oy + int(f["cfg"]["cabeca"] * mh)] = True
        # rosto = maior área branca dentro da silhueta, na zona da cabeça, + margem para pegar olhos/boca
        lab, n = ndi.label(sil & ~ink & cab)
        u, v = f["cfg"]["rosto"]                       # semente do rosto (coordenadas normalizadas da figura)
        sy, sx = oy + int(v * mh), ox + int(u * mw)
        jan = lab[max(0, sy - 60):sy + 60, max(0, sx - 60):sx + 60]
        cand = [c for c in np.unique(jan) if c]
        k = max(cand, key=lambda c: (lab == c).sum()) if cand else 0   # maior área branca perto da semente
        if k:
            face_branco = lab == k
            fr = ndi.binary_fill_holes(face_branco | (ink & ndi.binary_dilation(face_branco, iterations=int(0.012 * Hpe)) & cab))
            fr &= ndi.binary_fill_holes(ndi.binary_dilation(face_branco, iterations=int(0.004 * Hpe)))  # não invade o cabelo
            f["rosto"] = fr; f["face_branco"] = face_branco; rosto |= fr
        if "roda" in f["cfg"]:
            z = np.zeros_like(sil); z[oy + int(0.55 * mh):oy + mh] = True
            f["cadeira"] = sil & z; cadeira |= f["cadeira"]
    I["sil_all"] = sil_all
    I["rosto"] = rosto; I["cadeira"] = cadeira
    I["protegido"] = rosto | cadeira
    I["roupa_cabelo"] = sil_all & ~I["protegido"]
    return I


def massas(img, I):
    """Funde traços em massa preta só em roupas e cabelo (nunca rosto ou cadeira)."""
    r = CFG["MASSA_FECHAMENTO_H"] * I["Hpe"]
    fech = ndi.binary_closing(img, structure=disco(r)) & ndi.binary_erosion(I["sil_all"], iterations=2)
    zona = I["roupa_cabelo"] & ~ndi.binary_dilation(I["protegido"], iterations=int(r))
    out = img.copy(); out[zona] = fech[zona]
    return out


def contorno(img, I, rng):
    """Contorno externo engrossado e irregular + respiro branco."""
    W, H, L, Hpe = I["W"], I["H"], I["L"], I["Hpe"]
    dist = ndi.distance_transform_edt(~I["sil_all"])
    n = perlin((H, W), 0.06 * L, rng, 1)
    w = CFG["CONTORNO_H"] * Hpe * (1 + CFG["CONTORNO_VAR"] * np.clip(n, -1, 1))
    linha = (dist > 0) & (dist <= w)
    respiro = (dist > 0) & (dist <= w + CFG["RESPIRO_L"] * L)
    return img | linha, respiro


def hachura_fundo(I, rng, livre, fator):
    """Linhas horizontais onduladas, quebradas em trechos de goiva V; mais grossas longe da luz."""
    W, H, L = I["W"], I["H"], I["L"]
    esp, lw = CFG["HACH_ESPACO_L"] * L, CFG["HACH_LARG_L"] * L * fator
    def desenha(d):
        y = I["m"] + esp * 0.6
        while y < I["chao"]:
            x = I["m"] + rng.uniform(0, esp)
            fase = rng.uniform(0, 6.28)
            while x < W - I["m"]:
                comp = rng.uniform(*CFG["HACH_TRECHO_L"]) * L
                xs = np.linspace(x, min(x + comp, W - I["m"]), 24)
                pts = [(xx, y + CFG["HACH_ONDULA_L"] * L * math.sin(xx / (0.09 * L) + fase)) for xx in xs]
                sombra = 0.75 + 0.5 * ((x + comp / 2) / W * 0.5 + y / I["A"] * 0.5)   # luz no alto à esquerda
                stroke_afilado(d, pts, lw * sombra, "v")
                x += comp + rng.uniform(*CFG["HACH_PAUSA_L"]) * L
            y += esp
    return mascara_de(desenha, (H, W)) & livre


def hachura_roupas(img, I, rng):
    """Sombra em hachura nas regiões brancas grandes das roupas, no lado oposto à luz."""
    W, H, L, Hpe = I["W"], I["H"], I["L"], I["Hpe"]
    branco = I["roupa_cabelo"] & ~img
    branco = ndi.binary_erosion(branco, iterations=int(0.004 * L))
    lab, n = ndi.label(branco)
    out = np.zeros_like(img)
    lx, ly = np.array(CFG["LUZ"]) / np.hypot(*CFG["LUZ"])
    for k in range(1, n + 1):
        reg = lab == k
        if reg.sum() < (CFG["HACH_ROUPA_AREA_H"] * Hpe) ** 2: continue
        ys, xs = np.nonzero(reg); cy, cx = ys.mean(), xs.mean()
        cov = np.cov(np.vstack([xs - cx, ys - cy])); ev, evec = np.linalg.eigh(cov)
        eixo = evec[:, 1]; ang = math.atan2(eixo[1], eixo[0]) + math.pi / 2 + math.radians(rng.uniform(-8, 8))
        dx, dy = math.cos(ang), math.sin(ang)
        R = math.hypot(xs.max() - xs.min(), ys.max() - ys.min())
        esp = CFG["HACH_ROUPA_ESPACO_L"] * L; lw = CFG["HACH_ROUPA_LARG_L"] * L
        def desenha(d):
            o = -R
            while o < R:
                px, py = cx - dy * o, cy + dx * o
                stroke_afilado(d, [(px + dx * t, py + dy * t) for t in np.linspace(-R, R, 30)], lw, "v")
                o += esp
        lin = mascara_de(desenha, (H, W)) & reg
        # só o lado da sombra: projeção contra a luz além do centro
        yy, xx = np.nonzero(lin); proj = (xx - cx) * (-lx) + (yy - cy) * (-ly)
        keep = proj > -0.1 * R
        sel = np.zeros_like(lin); sel[yy[keep], xx[keep]] = True
        out |= sel
    return out


def cunhas(img, I, rng):
    """Entalhes brancos em cunha nas bordas iluminadas das massas pretas de roupas e cabelo."""
    W, H, L, Hpe = I["W"], I["H"], I["L"], I["Hpe"]
    massa = img & I["roupa_cabelo"] & ~ndi.binary_dilation(I["protegido"], iterations=int(0.01 * L))
    lab, n = ndi.label(massa)
    lx, ly = np.array(CFG["LUZ"]) / np.hypot(*CFG["LUZ"])
    cortes = Image.new("L", (W, H), 0); d = ImageDraw.Draw(cortes)
    passo = CFG["CUNHA_PASSO_L"] * L
    tot = 0
    for k in range(1, n + 1):
        reg = lab == k
        if reg.sum() < (CFG["CUNHA_MASSA_H"] * Hpe) ** 2: continue
        sm = ndi.gaussian_filter(reg.astype(np.float32), 0.006 * L)
        gy, gx = np.gradient(sm)
        borda = reg & ~ndi.binary_erosion(reg)
        ys, xs = np.nonzero(borda)
        ordem = rng.permutation(len(ys)); usados = []
        dentro = ndi.distance_transform_edt(reg)
        for i in ordem:
            y, x = ys[i], xs[i]
            nx, ny = -gx[y, x], -gy[y, x]; nn = math.hypot(nx, ny)
            if nn < 1e-6: continue
            nx, ny = nx / nn, ny / nn                               # normal para fora
            if nx * lx + ny * ly < 0.35: continue                   # só borda voltada para a luz
            if any((x - a) ** 2 + (y - b) ** 2 < passo ** 2 for a, b in usados): continue
            usados.append((x, y))
            comp = rng.uniform(*CFG["CUNHA_COMP_L"]) * L
            # não atravessa a massa: limita pela espessura local
            prof = dentro[min(H - 1, int(y - ny * 0.02 * L)), min(W - 1, int(x - nx * 0.02 * L))]
            comp = min(comp, 1.6 * prof + 0.015 * L)
            ang = math.atan2(-ly, -lx) + math.radians(rng.uniform(-1, 1) * CFG["CUNHA_DESVIO_GRAUS"])   # todas no sentido da luz
            tx, ty = x + math.cos(ang) * comp, y + math.sin(ang) * comp
            w = CFG["CUNHA_LARG_L"] * L * rng.uniform(0.7, 1.0) / 2
            px, py = -math.sin(ang) * w, math.cos(ang) * w
            d.polygon([(x + px, y + py), (x - px, y - py), (tx, ty)], fill=255)
            d.ellipse([x - w, y - w, x + w, y + w], fill=255)   # base arredondada (entrada da goiva)
            tot += 1
    return (np.array(cortes) > 127) & massa, tot


def cortes_cenario(I, rng):
    """Chão com goiva U, faixa com zigue-zague, postes com veio."""
    W, H, L = I["W"], I["H"], I["L"]; m = I["m"]
    def desenha(d):
        # chão: traços horizontais de largura constante, espaçamento crescendo para baixo (mais perto)
        y = I["chao"] + CFG["CHAO_RESPIRO_L"] * L; i = 0
        while y < I["A"] - m - CFG["CHAO_LARG_L"] * L:
            x = m + rng.uniform(0, 0.05) * L
            while x < W - m:
                comp = rng.uniform(*CFG["CHAO_COMP_L"]) * L
                if rng.random() < 0.75:
                    stroke_afilado(d, [(x, y), (min(x + comp, W - m - 0.01 * L), y + rng.uniform(-1, 1) * 0.002 * L)],
                                   CFG["CHAO_LARG_L"] * L, "u")
                x += comp + rng.uniform(0.01, 0.04) * L
            i += 1
            y += (CFG["CHAO_ESPACO_L"][0] + (CFG["CHAO_ESPACO_L"][1] - CFG["CHAO_ESPACO_L"][0]) * min(1, i / 5)) * L
        # faixa: triângulos alternados ao longo da tira
        x0, x1 = I["px0"], I["px1"] + I["pw"]; passo = CFG["FAIXA_PASSO_L"] * L
        n = int((x1 - x0) / passo)
        for j in range(1, n):
            x = x0 + j * passo; t = (x - x0) / (x1 - x0)
            ytop = I["fa_y"] + I["arco"] - 4 * I["arco"] * t * (1 - t)   # borda superior da curva da faixa
            yc = ytop + I["fa_h"] / 2; hh = I["fa_h"] * 0.32
            if j % 2: d.polygon([(x - passo * 0.38, yc - hh), (x + passo * 0.38, yc - hh), (x, yc + hh)], fill=255)
            else:     d.polygon([(x - passo * 0.38, yc + hh), (x + passo * 0.38, yc + hh), (x, yc - hh)], fill=255)
        # postes: dois veios verticais afilados cada
        for px in (I["px0"], I["px1"]):
            for f in (0.33, 0.66):
                yy0 = I["fa_y"] + I["fa_h"] + 0.04 * L; yy1 = I["chao"] - rng.uniform(0.03, 0.12) * L
                xs = px + I["pw"] * f
                stroke_afilado(d, [(xs + rng.uniform(-1, 1) * 0.002 * L, yy) for yy in np.linspace(yy0, yy1, 20)],
                               0.0035 * L, "v")
    return mascara_de(desenha, (H, W)) & I["cenario"] & ~I["bandeirolas"]


def rosto_b(img, I):
    """Variação B: apaga traços faciais do Peep e desenha olhos em ponto e boca simples."""
    L = I["L"]; tw = CFG["ROSTO_B_TRACO_L"] * L
    out = img.copy()
    im = Image.fromarray((out * 255).astype(np.uint8)); d = ImageDraw.Draw(im)
    for f in I["figuras"]:
        if "face_branco" not in f: continue
        fb = f["face_branco"]
        feicoes = ndi.binary_fill_holes(fb) & ~fb          # traços dentro da área do rosto
        if not feicoes.any(): continue
        out2 = np.array(im) > 127; out2[feicoes] = False
        im = Image.fromarray((out2 * 255).astype(np.uint8)); d = ImageDraw.Draw(im)
        # posição pelo contorno do rosto (bbox da área branca), em vista 3/4 voltada para a direita
        ys, xs = np.nonzero(ndi.binary_fill_holes(fb))
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); h, w = y1 - y0, x1 - x0
        ey = y0 + 0.36 * h
        for ex in (x0 + 0.42 * w, x0 + 0.74 * w):
            d.ellipse([ex - tw * 0.75, ey - tw * 0.9, ex + tw * 0.75, ey + tw * 0.9], fill=255)
        my, mx = y0 + 0.70 * h, x0 + 0.60 * w
        d.line([(mx - 0.11 * w, my), (mx + 0.11 * w, my + 0.01 * h)], fill=255, width=int(tw))
    return np.array(im) > 127


def moldura(I, rng):
    W, H, L = I["W"], I["H"], I["L"]; m, t, A = I["m"], I["t"], I["A"]
    rr = [rng.uniform(0, CFG["MOLD_CANTO_L"]) * L for _ in range(4)]
    def desenha(d):
        d.rounded_rectangle([m - t, m - t, W - m + t, A - m + t], radius=rr[0], fill=255)
    ext = mascara_de(desenha, (H, W))
    # cantos imperfeitos: cada canto com raio próprio, recortando por quadrante
    for i, (cx, cy) in enumerate([(m - t, m - t), (W - m + t, m - t), (W - m + t, A - m + t), (m - t, A - m + t)]):
        r = rr[i]; yy, xx = np.ogrid[:H, :W]
        q = (np.abs(xx - cx) < r) & (np.abs(yy - cy) < r)
        sx = cx + (r if i in (0, 3) else -r); sy = cy + (r if i in (0, 1) else -r)
        ext[q & ((xx - sx) ** 2 + (yy - sy) ** 2 > r * r) & (((xx - cx) * (sx - cx) >= 0) & ((yy - cy) * (sy - cy) >= 0))] = False
    n = perlin((H, W), CFG["PERLIN_ONDA_L"] * L, rng, 2) * CFG["PERLIN_AMP_L"] * L * CFG["MOLD_RUIDO_FATOR"]
    yy, xx = np.mgrid[0:H, 0:W]
    dint = np.minimum.reduce([xx - m, yy - m, (W - m) - xx, (A - m) - yy]).astype(np.float32)
    interior = dint > n
    mold = ext & ~interior
    # falhas: interrupções brancas em cada lado
    lados = []
    for lado in range(4):
        for _ in range(int(rng.integers(CFG["MOLD_FALHAS"][0], CFG["MOLD_FALHAS"][1] + 1))):
            c = rng.uniform(0.15, 0.85); g = rng.uniform(*CFG["MOLD_FALHA_L"]) * L
            lados.append((lado, c, g))
            if lado == 0: mold[:int(m + 1), int(m + c * (W - 2 * m) - g / 2):int(m + c * (W - 2 * m) + g / 2)] = False
            if lado == 2: mold[int(A - m - 1):, int(m + c * (W - 2 * m) - g / 2):int(m + c * (W - 2 * m) + g / 2)] = False
            if lado == 3: mold[int(m + c * (A - 2 * m) - g / 2):int(m + c * (A - 2 * m) + g / 2), :int(m + 1)] = False
            if lado == 1: mold[int(m + c * (A - 2 * m) - g / 2):int(m + c * (A - 2 * m) + g / 2), int(W - m - 1):] = False
    return mold, interior


def deformar(img, I, rng):
    """Borda de madeira: desloca tudo por Perlin + tremor; menos em rostos e cadeira."""
    H, W, L = img.shape[0], img.shape[1], I["L"]
    amp = np.where(ndi.binary_dilation(I["protegido"], iterations=int(0.01 * L)), CFG["AMP_PROTEGIDA"], 1.0)
    amp = ndi.gaussian_filter(amp.astype(np.float32), 0.01 * L)
    def campo():
        return (perlin((H, W), CFG["PERLIN_ONDA_L"] * L, rng, 2) * CFG["PERLIN_AMP_L"] * L
                + perlin((H, W), CFG["TREMOR_ONDA_L"] * L, rng, 1) * CFG["TREMOR_AMP_L"] * L)
    dx, dy = campo() * amp, campo() * amp
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    out = ndi.map_coordinates(img.astype(np.float32), [yy + dy, xx + dx], order=1, mode="nearest") > 0.5
    return out, float(np.abs(np.stack([dx, dy])).max() / L * 100)


def falhas_tinta(img, I, rng, mold_px):
    """Manchas brancas só em massas pretas contínuas > 3% da tela, mais perto da moldura."""
    H, W, L = img.shape[0], img.shape[1], I["L"]
    lab, n = ndi.label(img)
    tam = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    grandes = np.isin(lab, 1 + np.nonzero(tam > CFG["FALHA_MASSA_MIN"] * img.size)[0]) & ~ndi.binary_dilation(I["protegido"], iterations=int(0.02 * L))
    cel = int(0.006 * L)
    perto = 1 - np.clip(ndi.distance_transform_edt(~mold_px) / (0.15 * L), 0, 1)
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im); cont = 0
    rmin = max(CFG["FALHA_RAIO_L"][0] * L, math.sqrt(CFG["TURDSIZE"] / math.pi) * 1.4)
    for y in range(0, H, cel):
        for x in range(0, W, cel):
            if not grandes[y, x]: continue
            if rng.random() < CFG["FALHA_DENSIDADE"] * (1 + 4 * perto[y, x]) * 3:
                r = rng.uniform(rmin, CFG["FALHA_RAIO_L"][1] * L)
                pts = [(x + r * rng.uniform(0.6, 1.2) * math.cos(a), y + r * rng.uniform(0.6, 1.2) * math.sin(a))
                       for a in np.linspace(0, 2 * math.pi, 7)[:-1]]
                d.polygon(pts, fill=255); cont += 1
    return img & ~((np.array(im) > 127) & grandes), cont


def aplicar(I, variante, fator_hach=1.0):
    rng = np.random.default_rng(CFG["SEED"])
    W, H, L, A = I["W"], I["H"], I["L"], I["A"]
    img = I["base"] & ~I["moldura_orig"]
    img = massas(img, I)
    img, respiro = contorno(img, I, rng)
    # áreas livres para hachura: dentro da moldura, acima do chão, fora de tudo que é cenário/figura (+respiro)
    ocupado = ndi.binary_dilation(I["cenario"] & ~I["bandeirolas"] | I["bandeirolas"], iterations=int(CFG["RESPIRO_L"] * L)) | respiro | I["sil_all"]
    livre = np.zeros((H, W), bool); livre[int(I["m"]):int(I["chao"]), int(I["m"]):int(W - I["m"])] = True
    livre &= ~ocupado
    img |= hachura_fundo(I, rng, livre, fator_hach)
    img |= hachura_roupas(img, I, rng)
    c, ncunhas = cunhas(img, I, rng); img &= ~c
    img &= ~cortes_cenario(I, rng)
    if variante == "B": img = rosto_b(img, I)
    img, desloc = deformar(img, I, rng)
    r = disco(CFG["LIMPEZA_L"] * L)
    img = ~ndi.binary_opening(~img, structure=r)   # some fio branco fino demais para ser corte
    img = ndi.binary_opening(img, structure=r)     # some pingo preto solto
    mold, interior = moldura(I, rng)
    img = (img & interior) | mold
    img, nfalhas = falhas_tinta(img, I, rng, mold)
    arte = img[:A]
    return img, dict(preto_pct=round(float(arte.mean()) * 100, 1), cunhas=ncunhas, falhas=nfalhas,
                     desloc_max_pctL=round(desloc, 3))


if __name__ == "__main__":
    I = preparar()
    rel = {"versao": "0.3.0", "seed": CFG["SEED"], "L_px": CFG["L_PX"], "H_px": round(I["Hpe"], 1)}
    # calibra a hachura do fundo para a meta 55% (duas passadas determinísticas)
    fator = 1.0
    for _ in range(3):
        img, est = aplicar(I, "A", fator)
        erro = CFG["META_PRETO"] * 100 - est["preto_pct"]
        if abs(erro) < 1.5: break
        fator = float(np.clip(fator * (1 + erro / 25), 0.5, 2.2))
    rel["fator_hachura"] = round(fator, 3)
    for v in ("A", "B"):
        img, est = aplicar(I, v, fator)
        Image.fromarray(((~img) * 255).astype(np.uint8)).convert("1").save(f"xilo-1x1-rosto{v}.png")
        rel[f"rosto{v}"] = est
    json.dump(rel, open("relatorio-etapa3.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(rel, ensure_ascii=False, indent=1))
