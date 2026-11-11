"""gramatica.py — Gramática da Xilo como biblioteca, para a carteira de xilos.

Derivada do xilo.py 0.5.0 (CCP NEXATECH): mesmo ruído de Perlin, mesma goiva afilada, mesma deformação
de borda de madeira, mesma limpeza e mesma falha de tinta. O que muda: a entrada deixa de ser a cena
"Cheguei" (compose.py) e passa a ser qualquer desenho em SVG mais cortes e traços de goiva.
Vetorização com potracer (porta em Python do potrace), saída em um <path> com currentColor.
"""
import io
import math
import numpy as np
import cairosvg
import potrace
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

CFG = dict(
    PERLIN_AMP_L=0.0024, PERLIN_ONDA_L=0.012, TREMOR_AMP_L=0.0005, TREMOR_ONDA_L=0.003,
    LIMPEZA_L=0.0013,
    FALHA_MASSA_MIN=0.012, FALHA_RAIO_L=(0.0016, 0.0034), FALHA_DENSIDADE=0.008,
)


def perlin(shape, onda, rng, oitavas=2):
    H, W = shape
    out = np.zeros(shape, np.float32); amp = 1.0; tot = 0
    for o in range(oitavas):
        cell = max(4, onda / (2 ** o))
        gh, gw = int(H / cell) + 2, int(W / cell) + 2
        ang = rng.uniform(0, 2 * np.pi, (gh, gw)); gx, gy = np.cos(ang), np.sin(ang)
        ys = np.arange(H) / cell; xs = np.arange(W) / cell
        y0 = ys.astype(int); x0 = xs.astype(int); fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]

        def dot(dy, dx):
            return (gx[(y0 + dy)[:, None], (x0 + dx)[None, :]] * (fx - dx)
                    + gy[(y0 + dy)[:, None], (x0 + dx)[None, :]] * (fy - dy))
        fade = lambda t: t * t * t * (t * (t * 6 - 15) + 10)
        u, v = fade(fx), fade(fy)
        n = (dot(0, 0) * (1 - u) + dot(0, 1) * u) * (1 - v) + (dot(1, 0) * (1 - u) + dot(1, 1) * u) * v
        out += amp * n; tot += amp; amp *= 0.5
    return out / tot * 1.6


def disco(r):
    r = max(1, int(round(r))); y, x = np.ogrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r


def render(svg, W, H):
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=W, output_height=H, background_color="white")
    return np.array(Image.open(io.BytesIO(png)).convert("L")) < 128


def goiva(d, pts, larg, ponta="v"):
    """Traço de goiva: afilado nas pontas (V) ou de largura constante com pontas redondas (U)."""
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


class Pincel:
    """Desenha goivas em coordenadas da peça (unidades do viewBox), convertendo para pixels."""
    def __init__(self, W, H, s):
        self.im = Image.new("L", (W, H), 0); self.d = ImageDraw.Draw(self.im); self.s = s

    def linha(self, pts, larg, ponta="v"):
        if len(pts) == 2:                                   # dois pontos: interpola para a goiva poder afilar
            (xa, ya), (xb, yb) = pts
            pts = [(xa + (xb - xa) * t, ya + (yb - ya) * t) for t in np.linspace(0, 1, 14)]
        goiva(self.d, [(x * self.s, y * self.s) for x, y in pts], larg * self.s, ponta)

    def poligono(self, pts):
        self.d.polygon([(x * self.s, y * self.s) for x, y in pts], fill=255)

    def mascara(self):
        return np.array(self.im) > 127


def deformar(img, L, rng, fator=1.0):
    H, W = img.shape

    def campo():
        return (perlin((H, W), CFG["PERLIN_ONDA_L"] * L, rng, 2) * CFG["PERLIN_AMP_L"] * L
                + perlin((H, W), CFG["TREMOR_ONDA_L"] * L, rng, 1) * CFG["TREMOR_AMP_L"] * L) * fator
    dx, dy = campo(), campo()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    return ndi.map_coordinates(img.astype(np.float32), [yy + dy, xx + dx], order=1, mode="constant", cval=0) > 0.5


def limpar(img, L):
    r = disco(CFG["LIMPEZA_L"] * L)
    img = ~ndi.binary_opening(~img, structure=r)
    return ndi.binary_opening(img, structure=r)


def falhas(img, L, rng, densidade=1.0):
    """Manchas brancas pequenas só em massas pretas grandes."""
    H, W = img.shape
    lab, n = ndi.label(img)
    if not n: return img
    tam = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    grandes = np.isin(lab, 1 + np.nonzero(tam > CFG["FALHA_MASSA_MIN"] * img.size)[0])
    grandes = ndi.binary_erosion(grandes, iterations=int(0.004 * L))
    cel = max(4, int(0.006 * L))
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    for y in range(0, H, cel):
        for x in range(0, W, cel):
            if grandes[y, x] and rng.random() < CFG["FALHA_DENSIDADE"] * 3 * densidade:
                r = rng.uniform(*CFG["FALHA_RAIO_L"]) * L
                pts = [(x + r * rng.uniform(0.6, 1.2) * math.cos(a), y + r * rng.uniform(0.6, 1.2) * math.sin(a))
                       for a in np.linspace(0, 2 * math.pi, 7)[:-1]]
                d.polygon(pts, fill=255)
    return img & ~((np.array(im) > 127) & grandes)


def gravar(peca, seed=2026, L=2048):
    """peca: dict(vb=(w, h), svg=str, tracos=fn(Pincel, rng), cortes=fn(Pincel, rng), falhas=float, deforma=float)."""
    rng = np.random.default_rng(seed)
    vw, vh = peca["vb"]; s = L / max(vw, vh); W, H = int(round(vw * s)), int(round(vh * s))
    doc = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}">{peca["svg"]}</svg>'
    img = render(doc, W, H)
    if peca.get("tracos"):
        p = Pincel(W, H, s); peca["tracos"](p, rng); img |= p.mascara()
    if peca.get("cortes"):
        p = Pincel(W, H, s); peca["cortes"](p, rng); img &= ~p.mascara()
    if peca.get("fundo"):                                    # hachura de fundo, com respiro em volta de tudo que já é tinta
        x0, y0, x1, y1 = peca["fundo"]; p = Pincel(W, H, s); y = y0 + 12
        while y < y1 - 6:
            x = x0 + rng.uniform(0, 12); fase = rng.uniform(0, 6.28)
            while x < x1:
                c = rng.uniform(50, 200)
                xs = np.linspace(x, min(x + c, x1), 20)
                sombra = 0.75 + 0.5 * (((x + c / 2) - x0) / (x1 - x0) * 0.5 + (y - y0) / (y1 - y0) * 0.5)
                p.linha([(xx, y + 2.5 * math.sin(xx / 90 + fase)) for xx in xs], 4.6 * sombra, "v")
                x += c + rng.uniform(6, 22)
            y += 10.5
        livre = ~ndi.binary_dilation(img, iterations=int(0.007 * L))
        if peca.get("silhuetas"):                            # nada de hachura dentro das figuras, e um halo em volta
            sil = render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}">{peca["silhuetas"]}</svg>', W, H)
            sil = ndi.binary_fill_holes(ndi.binary_closing(sil, structure=disco(0.006 * L)))
            livre &= ~ndi.binary_dilation(sil, structure=disco(0.011 * L))
        img |= p.mascara() & livre
    img = deformar(img, L, rng, peca.get("deforma", 1.0))
    img = limpar(img, L)
    if peca.get("falhas", 1.0):
        img = falhas(img, L, rng, peca.get("falhas", 1.0))
    return img


def vetorizar(img, largura, turd=10, alpha=0.9, opt=0.6):
    """Bitmap 1 bit → d de um <path> (evenodd), com coordenadas inteiras em `largura` px."""
    H, W = img.shape; alt = int(round(H * largura / W))
    pil = Image.fromarray((img * 255).astype(np.uint8)).resize((largura, alt), Image.LANCZOS)
    bm = potrace.Bitmap(np.array(pil) <= 127)   # potracer traça o que é False/escuro
    plist = bm.trace(turdsize=turd, alphamax=alpha, opticurve=True, opttolerance=opt)
    f = lambda v: str(int(round(v)))
    partes = []
    for curva in plist:
        partes.append(f"M{f(curva.start_point.x)} {f(curva.start_point.y)}")
        for seg in curva.segments:
            if seg.is_corner:
                partes.append(f"L{f(seg.c.x)} {f(seg.c.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}")
            else:
                partes.append(f"C{f(seg.c1.x)} {f(seg.c1.y)} {f(seg.c2.x)} {f(seg.c2.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}")
        partes.append("Z")
    return "".join(partes), largura, alt


def montar(d, w, h, comentario):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" aria-hidden="true" focusable="false">'
            f'<!-- {comentario} --><path fill="currentColor" fill-rule="evenodd" d="{d}"/></svg>')
