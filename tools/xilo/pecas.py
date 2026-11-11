"""pecas.py — receitas da carteira (lote 1). Cada peça: desenho em SVG + traços e cortes de goiva."""
import math
import numpy as np

PRETO = 'fill="#000"'


def _poli(pts):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)


# ---------- faixa de bandeirolas (divisória) ----------
def bandeirolas():
    vw, vh = 1600, 260
    corda = lambda x: 46 + 44 * 4 * (x / vw) * (1 - x / vw)          # barriga da corda
    svg = f'<path d="M14 46 Q {vw / 2} {46 + 88} {vw - 14} 46" fill="none" stroke="#000" stroke-width="11" stroke-linecap="round"/>'
    n = 13; passo = (vw - 120) / (n - 1)
    for i in range(n):
        x = 60 + i * passo; y = corda(x) + 2; w, h = 78, 118 + (8 if i % 3 == 0 else 0)
        pts = [(x - w / 2, y), (x + w / 2, y), (x + (6 if i % 2 else -6), y + h)]
        if i % 2 == 0:
            svg += f'<polygon points="{_poli(pts)}" {PRETO} stroke="#000" stroke-width="10" stroke-linejoin="round"/>'
        else:
            svg += f'<polygon points="{_poli(pts)}" fill="#fff" stroke="#000" stroke-width="11" stroke-linejoin="round"/>'

    def cortes(p, rng):                                                # um talho de luz em cada bandeirola preta
        for i in range(0, n, 2):
            x = 60 + i * passo; y = corda(x) + 2
            p.linha([(x - 16, y + 20), (x - 6, y + 62)], 9, "v")

    def tracos(p, rng):                                                # sombra em hachura nas brancas
        for i in range(1, n, 2):
            x = 60 + i * passo; y = corda(x) + 2
            for k in range(3):
                p.linha([(x + 4 + k * 3, y + 26 + k * 16), (x + 22 - k * 5, y + 20 + k * 16)], 6, "v")
    return dict(vb=(vw, vh), svg=svg, cortes=cortes, tracos=tracos, falhas=0.5)


# ---------- ingresso (objeto) ----------
def ingresso():
    cx, cy, w, h, r = 500, 500, 780, 430, 34
    x0, y0 = cx - w / 2, cy - h / 2; xp = x0 + 250                     # picote
    corpo = (f'<g transform="rotate(-9 {cx} {cy})">'
             f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="{r}" {PRETO}/>'
             f'<circle cx="{xp}" cy="{y0}" r="30" fill="#fff"/><circle cx="{xp}" cy="{y0 + h}" r="30" fill="#fff"/>'
             f'<rect x="{x0 + 26}" y="{y0 + 26}" width="{w - 52}" height="{h - 52}" rx="{r - 14}" fill="none" stroke="#fff" stroke-width="9"/>')
    # estrela na parte grande
    ex, ey, R, ri = xp + 150, cy, 92, 38
    est = [(ex + (R if k % 2 == 0 else ri) * math.sin(k * math.pi / 5), ey - (R if k % 2 == 0 else ri) * math.cos(k * math.pi / 5)) for k in range(10)]
    corpo += f'<polygon points="{_poli(est)}" fill="#fff"/>'
    # picote: furos
    for k in range(7):
        corpo += f'<circle cx="{xp}" cy="{y0 + 62 + k * 51}" r="9" fill="#fff"/>'
    corpo += "</g>"
    ang = math.radians(-9)
    rot = lambda x, y: (cx + (x - cx) * math.cos(ang) - (y - cy) * math.sin(ang), cy + (x - cx) * math.sin(ang) + (y - cy) * math.cos(ang))

    def cortes(p, rng):
        # linhas de "texto" talhadas à direita da estrela e no canhoto
        for k, comp in enumerate((170, 120, 150)):
            xa = ex + 125; ya = cy - 60 + k * 60
            p.linha([rot(xa, ya), rot(xa + comp, ya)], 20, "u")
        for k in range(3):
            xa = x0 + 70; ya = cy - 70 + k * 70
            p.linha([rot(xa, ya), rot(xa + 110, ya)], 18, "u")

    def tracos(p, rng):                                                # sombra no chão
        for k in range(5):
            y = 800 + k * 24; a = 230 + k * 46 + rng.uniform(-20, 20)
            p.linha([(a, y), (a + 560 - k * 95, y - 6)], 13 - k * 1.5, "v")
    return dict(vb=(1000, 1000), svg=corpo, cortes=cortes, tracos=tracos, falhas=1.0)


# ---------- nada por aqui: mandacaru e sol ----------
def nada_por_aqui():
    svg = ""
    # sol com raios em cunha
    sx, sy, sr = 745, 235, 86
    svg += f'<circle cx="{sx}" cy="{sy}" r="{sr}" {PRETO}/>'
    for k in range(14):
        a = k * 2 * math.pi / 14; r1, r2 = sr + 22, sr + (88 if k % 2 == 0 else 58); la = 0.10
        pts = [(sx + r1 * math.cos(a - la), sy + r1 * math.sin(a - la)), (sx + r1 * math.cos(a + la), sy + r1 * math.sin(a + la)),
               (sx + r2 * math.cos(a), sy + r2 * math.sin(a))]
        svg += f'<polygon points="{_poli(pts)}" {PRETO}/>'
    # mandacaru: tronco e braços, pontas redondas
    st = 'fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"'
    svg += f'<path d="M400 812 V330" {st} stroke-width="104"/>'
    svg += f'<path d="M400 640 H258 V452" {st} stroke-width="70"/>'
    svg += f'<path d="M400 548 H548 V372" {st} stroke-width="70"/>'
    # chão
    svg += f'<rect x="90" y="806" width="820" height="92" rx="10" {PRETO}/>'
    # pedras
    svg += f'<ellipse cx="655" cy="800" rx="62" ry="30" {PRETO}/><ellipse cx="205" cy="802" rx="38" ry="20" {PRETO}/>'

    def cortes(p, rng):
        # veios do mandacaru (goiva V, interrompidos)
        for x, ya, yb in ((372, 350, 780), (428, 340, 780), (240, 470, 610), (276, 470, 600), (530, 390, 520), (566, 390, 510)):
            y = ya
            while y < yb:
                c = rng.uniform(60, 130)
                p.linha([(x + rng.uniform(-2, 2), y), (x + rng.uniform(-2, 2), min(y + c, yb))], 10, "v")
                y += c + rng.uniform(14, 30)
        # espinhos: talhos curtos na borda iluminada (esquerda)
        for y in range(360, 780, 46):
            p.linha([(352, y), (366, y + 12)], 7, "v")
        # sol: anel talhado
        pts = [(sx + 52 * math.cos(a), sy + 52 * math.sin(a)) for a in np.linspace(2.6, 5.2, 16)]
        p.linha(pts, 11, "v")
        # chão: goiva U horizontal
        y = 832
        for i in range(3):
            x = 110 + rng.uniform(0, 30)
            while x < 880:
                c = rng.uniform(50, 170)
                if rng.random() < 0.8:
                    p.linha([(x, y), (min(x + c, 890), y + rng.uniform(-2, 2))], 9, "u")
                x += c + rng.uniform(18, 50)
            y += 24

    def tracos(p, rng):
        # sombra do mandacaru no chão não: céu limpo. Só um horizonte quebrado, longe.
        x = 100
        while x < 900:
            c = rng.uniform(40, 120)
            if not (300 < x < 620):
                p.linha([(x, 742), (x + c, 742 + rng.uniform(-2, 2))], 7, "v")
            x += c + rng.uniform(20, 60)
    return dict(vb=(1000, 1000), svg=svg, cortes=cortes, tracos=tracos, falhas=1.0)


# ---------- sem internet: jangada na calmaria ----------
def sem_internet():
    st = 'fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"'
    svg = ""
    # vela (latina, bojo para a esquerda)
    svg += f'<path d="M520 208 Q 300 380 232 640 L 536 668 Z" {PRETO} stroke="#000" stroke-width="12" stroke-linejoin="round"/>'
    # mastro e retranca
    svg += f'<path d="M540 700 L520 190" {st} stroke-width="17"/><path d="M212 642 L 560 674" {st} stroke-width="13"/>'
    # casco de toras
    svg += f'<path d="M250 722 H 742 Q 770 722 792 700" {st} stroke-width="46"/>'
    # banco e remo
    svg += f'<path d="M630 700 V 640 H 700 V 700" {st} stroke-width="13"/><path d="M660 600 L 820 742" {st} stroke-width="11"/>'
    # sol baixo no horizonte (meio disco)
    svg += f'<path d="M 720 470 A 70 70 0 0 1 860 470 Z" {PRETO}/>'

    def cortes(p, rng):
        # panos da vela: talhos paralelos ao bordo de ataque
        for k in range(1, 5):
            t = k / 5
            a = (520 - 16, 250 + 30 * k); b = (232 + 304 * t + 10, 640 + 28 * t - 26)
            m = ((a[0] + b[0]) / 2 - 60 * (1 - t), (a[1] + b[1]) / 2)
            pts = [((1 - u) ** 2 * a[0] + 2 * (1 - u) * u * m[0] + u ** 2 * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * m[1] + u ** 2 * b[1]) for u in np.linspace(0.06, 0.94, 14)]
            p.linha(pts, 9, "v")
        # toras do casco
        x = 268
        while x < 730:
            c = rng.uniform(70, 150)
            p.linha([(x, 722), (min(x + c, 740), 722)], 8, "u"); x += c + rng.uniform(16, 34)

    def tracos(p, rng):
        # horizonte quebrado
        x = 90
        while x < 910:
            c = rng.uniform(50, 140)
            if not (205 < x + c / 2 < 560):
                p.linha([(x, 470), (x + c, 470 + rng.uniform(-1.5, 1.5))], 7, "v")
            x += c + rng.uniform(16, 40)
        # mar calmo: ondas longas e baixas, mais grossas embaixo
        y = 770; i = 0
        while y < 930:
            x = 110 + rng.uniform(0, 60); fase = rng.uniform(0, 6.28)
            while x < 890:
                c = rng.uniform(90, 230)
                xs = np.linspace(x, min(x + c, 895), 18)
                p.linha([(xx, y + 4 * math.sin(xx / 46 + fase)) for xx in xs], 9 + i * 2.2, "v")
                x += c + rng.uniform(24, 60)
            y += 30 + i * 3; i += 1
    return dict(vb=(1000, 1000), svg=svg, cortes=cortes, tracos=tracos, falhas=0.8)


# ---------- algo deu errado: pipa enroscada no fio ----------
def algo_deu_errado():
    st = 'fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"'
    svg = ""
    # poste com cruzeta e dois fios
    svg += f'<rect x="792" y="170" width="46" height="716" rx="6" {PRETO}/><rect x="700" y="236" width="230" height="24" rx="6" {PRETO}/>'
    svg += f'<path d="M712 250 Q 400 372 60 296" {st} stroke-width="9"/><path d="M918 250 Q 950 262 985 258" {st} stroke-width="9"/>'
    svg += f'<path d="M712 250 Q 420 300 60 232" {st} stroke-width="7"/>'
    # pipa (losango inclinado), presa no fio de baixo
    cx, cy = 400, 480; a = math.radians(17)
    r = lambda x, y: (cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a))
    los = [r(0, -175), r(135, -30), r(0, 185), r(-135, -30)]
    svg += f'<polygon points="{_poli(los)}" {PRETO} stroke="#000" stroke-width="12" stroke-linejoin="round"/>'
    # rabiola com laços
    rab = [r(0, 185)] + [(los[2][0] + 34 * math.sin(k * 1.25) + k * 16, los[2][1] + k * 48) for k in range(1, 6)]
    svg += f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x, y in rab)}" {st} stroke-width="8"/>'
    for (x, y) in rab[1:5]:
        svg += f'<polygon points="{_poli([(x, y), (x - 30, y - 15), (x - 30, y + 15)])}" {PRETO}/><polygon points="{_poli([(x, y), (x + 30, y - 15), (x + 30, y + 15)])}" {PRETO}/>'
    # linha solta, caindo em voltas
    svg += f'<path d="M{r(0, 10)[0]:.0f} {r(0, 10)[1]:.0f} C 250 560 150 600 170 700 S 300 780 210 860" {st} stroke-width="6"/>'

    def cortes(p, rng):
        p.linha([r(0, -150), r(0, 160)], 10, "u")                      # varetas
        p.linha([r(-112, -30), r(112, -30)], 10, "u")
        for k in range(3):                                             # talhos de luz no pano
            p.linha([r(-70 + k * 22, -8 + k * 34), r(-28 + k * 12, -8 + k * 34 + 40)], 8, "v")
        for y in range(300, 860, 110):                                 # veio do poste
            p.linha([(808 + rng.uniform(-2, 2), y), (808 + rng.uniform(-2, 2), y + rng.uniform(50, 90))], 8, "v")

    def tracos(p, rng):
        x = 80
        while x < 920:                                                 # chão quebrado
            c = rng.uniform(50, 150)
            p.linha([(x, 892), (x + c, 892 + rng.uniform(-2, 2))], 9, "v"); x += c + rng.uniform(18, 46)
    return dict(vb=(1000, 1000), svg=svg, cortes=cortes, tracos=tracos, falhas=0.9)


# ---------- tudo pronto: sol nascendo sob as bandeirolas ----------
def tudo_pronto():
    svg = ""
    sx, sy, sr = 500, 690, 178
    svg += f'<path d="M{sx - sr} {sy} A {sr} {sr} 0 0 1 {sx + sr} {sy} Z" {PRETO}/>'
    for k in range(11):
        a = math.radians(196 + k * 14.8); r1, r2 = sr + 30, sr + (190 if k % 2 == 0 else 120); la = 0.062
        pts = [(sx + r1 * math.cos(a - la), sy + r1 * math.sin(a - la)), (sx + r1 * math.cos(a + la), sy + r1 * math.sin(a + la)),
               (sx + r2 * math.cos(a), sy + r2 * math.sin(a))]
        svg += f'<polygon points="{_poli(pts)}" {PRETO}/>'
    svg += f'<rect x="80" y="{sy}" width="840" height="96" rx="10" {PRETO}/>'
    # bandeirolas no alto
    corda = lambda x: 120 + 70 * 4 * ((x - 70) / 860) * (1 - (x - 70) / 860)
    svg += f'<path d="M70 120 Q 500 260 930 120" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round"/>'
    for i in range(9):
        x = 120 + i * 95; y = corda(x) + 2
        pts = [(x - 34, y), (x + 34, y), (x + (5 if i % 2 else -5), y + 92)]
        cor = PRETO if i % 2 == 0 else 'fill="#fff"'
        svg += f'<polygon points="{_poli(pts)}" {cor} stroke="#000" stroke-width="10" stroke-linejoin="round"/>'

    def cortes(p, rng):
        pts = [(sx + 118 * math.cos(a), sy + 118 * math.sin(a)) for a in np.linspace(3.5, 4.9, 16)]
        p.linha(pts, 13, "v")                                          # brilho do sol
        y = sy + 30
        for i in range(3):                                             # chão em goiva U
            x = 100 + rng.uniform(0, 30)
            while x < 890:
                c = rng.uniform(50, 170)
                if rng.random() < 0.8:
                    p.linha([(x, y), (min(x + c, 900), y + rng.uniform(-2, 2))], 9, "u")
                x += c + rng.uniform(18, 50)
            y += 24
        for i in range(0, 9, 2):                                       # talho em cada bandeirola preta
            x = 120 + i * 95; yy = corda(x) + 2
            p.linha([(x - 12, yy + 16), (x - 4, yy + 50)], 8, "v")
    return dict(vb=(1000, 1000), svg=svg, cortes=cortes, falhas=1.0)


PECAS = {
    "faixa-bandeirolas": (bandeirolas, 1280, "Faixa de bandeirolas, divisória"),
    "ingresso": (ingresso, 1024, "Ingresso com picote e estrela"),
    "nada-por-aqui": (nada_por_aqui, 1024, "Mandacaru sob o sol, para telas vazias"),
    "sem-internet": (sem_internet, 1024, "Jangada parada no mar calmo, para quando falta internet"),
    "algo-deu-errado": (algo_deu_errado, 1024, "Pipa enroscada no fio, para erros"),
    "tudo-pronto": (tudo_pronto, 1024, "Sol nascendo sob bandeirolas, para confirmações"),
}


# ---------- símbolos: desenho direto, sem vetorização, 24 × 24 ----------
def _capsula(x1, y1, x2, y2, r):
    a = math.atan2(y2 - y1, x2 - x1); nx, ny = -math.sin(a) * r, math.cos(a) * r
    f = lambda v: f"{v:.2f}"
    return (f"M{f(x1 + nx)} {f(y1 + ny)}L{f(x2 + nx)} {f(y2 + ny)}A{r} {r} 0 0 0 {f(x2 - nx)} {f(y2 - ny)}"
            f"L{f(x1 - nx)} {f(y1 - ny)}A{r} {r} 0 0 0 {f(x1 + nx)} {f(y1 + ny)}Z")


def _mao(ox, oy, esc, rot, espelho=1):
    """Mão aberta: palma e cinco dedos, em cápsulas. Devolve subcaminhos já transformados."""
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    T = lambda x, y: (ox + esc * (espelho * x * c - y * s), oy + esc * (espelho * x * s + y * c))
    segs = [((-1.9, 2.4), (1.9, 2.4), 2.6),                                           # palma
            ((-3.3, 0.6), (-4.3, -3.6), 0.82), ((-1.15, -0.2), (-1.5, -5.6), 0.86),    # mínimo, anelar
            ((1.0, -0.2), (1.0, -6.2), 0.86), ((3.1, 0.6), (3.7, -4.9), 0.82),         # médio, indicador
            ((3.4, 3.4), (6.6, 1.0), 0.95)]                                            # polegar
    return "".join(_capsula(*T(*a), *T(*b), round(r * esc, 2)) for a, b, r in segs)


def simbolo_libras():
    d = _mao(7.4, 15.4, 1.0, -14) + _mao(16.8, 10.2, 1.0, 14, -1)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="{d}"/></svg>'


def simbolo_ingresso():
    est = [(14.6 + (3.3 if k % 2 == 0 else 1.4) * math.sin(k * math.pi / 5), 12 - (3.3 if k % 2 == 0 else 1.4) * math.cos(k * math.pi / 5)) for k in range(10)]
    estrela = "M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in est) + "Z"
    corpo = "M4 5.5h4.2a1.3 1.3 0 0 0 2.6 0H20a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 18.5h-9.2a1.3 1.3 0 0 0-2.6 0H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Z"
    furos = "".join(f"M9.5 {y}m-.7 0a.7.7 0 1 0 1.4 0a.7.7 0 1 0-1.4 0Z" for y in (9, 12, 15))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            f'<path fill="currentColor" fill-rule="evenodd" d="{corpo}{estrela}{furos}"/></svg>')


def _circ(cx, cy, r):
    return f"M{cx - r:.2f} {cy}a{r} {r} 0 1 0 {2 * r} 0a{r} {r} 0 1 0 {-2 * r} 0Z"


def _estrela(cx, cy, R, r):
    pts = [(cx + (R if k % 2 == 0 else r) * math.sin(k * math.pi / 5), cy - (R if k % 2 == 0 else r) * math.cos(k * math.pi / 5)) for k in range(10)]
    return "M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + "Z"


def _setor(cx, cy, ri, ro, a0, a1):
    P = lambda r, a: f"{cx + r * math.cos(math.radians(a)):.2f} {cy + r * math.sin(math.radians(a)):.2f}"
    return f"M{P(ro, a0)}A{ro} {ro} 0 0 1 {P(ro, a1)}L{P(ri, a1)}A{ri} {ri} 0 0 0 {P(ri, a0)}Z"


def _simbolo(d):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            f'<path fill="currentColor" fill-rule="evenodd" d="{d}"/></svg>')


def simbolo_legenda():
    tela = "M5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5Z"
    linhas = _capsula(6.6, 12.3, 12.4, 12.3, 0.85) + _capsula(15.2, 12.3, 17.4, 12.3, 0.85) + _capsula(6.6, 15.5, 9.4, 15.5, 0.85) + _capsula(12.2, 15.5, 17.4, 15.5, 0.85)
    return _simbolo(tela + linhas)


def simbolo_audiodescricao():
    caixa = "M2.8 9.4h3.3L10.8 5.5v13L6.1 14.6H2.8Z"
    return _simbolo(caixa + _setor(10.6, 12, 3.3, 5.0, -42, 42) + _setor(10.6, 12, 6.9, 8.6, -42, 42))


def simbolo_sem_degraus():
    rampa = "M2.5 20.5L21.5 20.5L21.5 11Z"
    return _simbolo(rampa + _circ(8.1, 14.2, 2.75) + _circ(8.1, 14.2, 1.0))


def simbolo_favorito():
    return _simbolo(_estrela(12, 12.7, 9.6, 4.0))


def simbolo_aviso():
    sino = ("M12 3a1.4 1.4 0 0 1 1.4 1.4v.5a5.6 5.6 0 0 1 4.2 5.5v3.4l1.7 2.6a.9.9 0 0 1-.75 1.4H5.45a.9.9 0 0 1-.75-1.4l1.7-2.6v-3.4"
            "a5.6 5.6 0 0 1 4.2-5.5v-.5A1.4 1.4 0 0 1 12 3Z")
    return _simbolo(sino + "M9.8 19.3h4.4a2.2 2.2 0 0 1-4.4 0Z")


def simbolo_mapa():
    pino = "M12 2.5a6.8 6.8 0 0 1 6.8 6.8c0 4.6-4.6 9.6-6.8 12.2-2.2-2.6-6.8-7.6-6.8-12.2A6.8 6.8 0 0 1 12 2.5Z"
    return _simbolo(pino + _circ(12, 9.3, 2.5))


def simbolo_camera():
    corpo = "M4.5 7h2.6l1.3-2h7.2l1.3 2h2.6a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
    return _simbolo(corpo + _circ(12, 13.2, 3.9) + _circ(12, 13.2, 1.7))


def simbolo_privacidade():
    corpo = "M6 10.6h12a1.5 1.5 0 0 1 1.5 1.5v7.4A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-7.4A1.5 1.5 0 0 1 6 10.6Z"
    argola = "M7.9 10.2V8a4.1 4.1 0 0 1 8.2 0v2.2h-2.1V8a2 2 0 0 0-4 0v2.2Z"
    return _simbolo(corpo + argola + _circ(12, 15.6, 1.7))


SIMBOLOS = {"simbolo-libras": (simbolo_libras, "Duas mãos sinalizando, selo de Libras"),
            "simbolo-ingresso": (simbolo_ingresso, "Ingresso, para a aba Ingresso"),
            "simbolo-legenda": (simbolo_legenda, "Tela com linhas de legenda"),
            "simbolo-audiodescricao": (simbolo_audiodescricao, "Alto-falante, selo de audiodescrição"),
            "simbolo-sem-degraus": (simbolo_sem_degraus, "Rampa com roda, acesso sem degraus"),
            "simbolo-favorito": (simbolo_favorito, "Estrela, favoritar sessão"),
            "simbolo-aviso": (simbolo_aviso, "Sino, avisos"),
            "simbolo-mapa": (simbolo_mapa, "Pino de mapa, local"),
            "simbolo-camera": (simbolo_camera, "Câmera, permissão e leitor de QR"),
            "simbolo-privacidade": (simbolo_privacidade, "Cadeado, privacidade e dados")}
