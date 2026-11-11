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


# ---------- figuras próprias: corpo em formas, de três quartos, andando (inspiração: Open Peeps) ----------
_ST = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'


class _Fig:
    """Acumula as formas de uma figura. u cresce para onde ela olha, v para cima; medidas em frações de H."""
    def __init__(self, x, chao, H, espelho=False, uid="f"):
        self.x, self.chao, self.H, self.s, self.uid = x, chao, H, (-1 if espelho else 1), uid
        self.ol = 0.016 * H; self.o = []

    def P(self, u, v):
        return (self.x + self.s * u * self.H, self.chao - v * self.H)

    def membro(self, pts, larg, cor):
        d = "M" + " L".join(f"{a:.1f} {b:.1f}" for a, b in (self.P(*q) for q in pts))
        self.o.append(f'<path d="{d}" {_ST} stroke="#000" stroke-width="{larg * self.H:.1f}"/>')
        if cor == "w":
            self.o.append(f'<path d="{d}" {_ST} stroke="#fff" stroke-width="{larg * self.H - 2 * self.ol:.1f}"/>')

    def linha(self, pts, larg):
        d = "M" + " L".join(f"{a:.1f} {b:.1f}" for a, b in (self.P(*q) for q in pts))
        self.o.append(f'<path d="{d}" {_ST} stroke="#000" stroke-width="{larg * self.H:.1f}"/>')

    def disco(self, u, v, r, cor="b", borda=1.0):
        cx, cy = self.P(u, v)
        f = "#000" if cor == "b" else "#fff"
        self.o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * self.H:.1f}" fill="{f}" stroke="#000" stroke-width="{self.ol * borda:.1f}"/>')

    def elipse(self, u, v, rx, ry, cor="b", giro=0, borda=1.0):
        cx, cy = self.P(u, v); f = "#000" if cor == "b" else "#fff"
        self.o.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx * self.H:.1f}" ry="{ry * self.H:.1f}" fill="{f}" stroke="#000" '
                      f'stroke-width="{self.ol * borda:.1f}" transform="rotate({giro * self.s:.0f} {cx:.1f} {cy:.1f})"/>')

    def tronco(self, A, c1, B, C, c2, D, cor):
        q = lambda t: "{:.1f} {:.1f}".format(*self.P(*t))
        d = f"M{q(A)} Q{q(c1)} {q(B)} L{q(C)} Q{q(c2)} {q(D)} Z"
        f = "#000" if cor == "b" else "#fff"
        self.o.append(f'<path d="{d}" fill="{f}" stroke="#000" stroke-width="{self.ol * 2:.1f}" stroke-linejoin="round"/>')
        if cor == "w":                                    # sombra em hachura no lado oposto à luz
            self.o.append(f'<clipPath id="c{self.uid}"><path d="{d}"/></clipPath><g clip-path="url(#c{self.uid})">')
            (u0, v0), (u1, v1) = B, C
            for k in range(6):
                self.linha([(u0 + 0.02, v0 - 0.035 - 0.042 * k), (u0 - 0.10, v0 - 0.115 - 0.042 * k)], 0.011)
            self.o.append("</g>")

    def mao(self, u, v, aberta=False):
        if not aberta:
            self.disco(u, v, 0.036, "w"); return
        for (a, b) in (((-0.030, 0.026), (-0.048, 0.082)), ((-0.010, 0.036), (-0.014, 0.100)),
                       ((0.012, 0.036), (0.018, 0.098)), ((0.032, 0.026), (0.052, 0.080))):      # quatro dedos abertos
            d = "M{:.1f} {:.1f} L{:.1f} {:.1f}".format(*self.P(u + a[0], v + a[1]), *self.P(u + b[0], v + b[1]))
            self.o.append(f'<path d="{d}" {_ST} stroke="#000" stroke-width="{0.036 * self.H:.1f}"/>')
            self.o.append(f'<path d="{d}" {_ST} stroke="#fff" stroke-width="{0.017 * self.H:.1f}"/>')
        self.disco(u, v, 0.043, "w")

    def cabeca(self, cabelo, oculos=False, dv=0.0, du=0.0):
        g = lambda u, v: (u + du, v + dv)
        self.membro([g(0.022, 0.80), g(0.016, 0.745)], 0.052, "w")           # pescoço
        if cabelo == "longo":
            pts = [g(-0.08, 0.95), g(-0.125, 0.71), g(-0.01, 0.69), g(0.01, 0.90)]
            d = "M" + " L".join("{:.1f} {:.1f}".format(*self.P(*q)) for q in pts) + "Z"
            self.o.append(f'<path d="{d}" fill="#000" stroke="#000" stroke-width="{self.ol * 3:.1f}" stroke-linejoin="round"/>')
        if cabelo == "afro":
            self.disco(*g(0.0, 0.905), 0.132)
        else:
            self.elipse(*g(0.012, 0.906), 0.094, 0.093)
        if cabelo == "coque":
            self.disco(*g(-0.07, 1.0), 0.046)
        self.elipse(*g(0.052, 0.872), 0.064, 0.077, "w", borda=1.3)           # rosto, voltado para a frente
        if oculos:
            (x0, y0), (x1, y1) = self.P(*g(0.022, 0.905)), self.P(*g(0.122, 0.868))
            self.o.append(f'<rect x="{min(x0, x1):.1f}" y="{y0:.1f}" width="{abs(x1 - x0):.1f}" height="{y1 - y0:.1f}" rx="{0.01 * self.H:.1f}" fill="#000"/>')
            self.linha([g(0.03, 0.89), g(-0.02, 0.892)], 0.012)
        else:
            self.disco(*g(0.058, 0.886), 0.008); self.disco(*g(0.096, 0.886), 0.008)
        self.linha([g(0.114, 0.872), g(0.129, 0.858), g(0.113, 0.852)], 0.011)   # nariz
        q = lambda t: "{:.1f} {:.1f}".format(*self.P(*g(*t)))
        self.o.append(f'<path d="M{q((0.05, 0.842))} Q{q((0.078, 0.82))} {q((0.104, 0.843))}" {_ST} stroke="#000" stroke-width="{self.ol * 0.8:.1f}"/>')

    def svg(self):
        return "".join(self.o)


def _andando(x, chao, H, cabelo="curto", camisa="w", calca="b", braco="balanco", oculos=False, espelho=False, uid="a"):
    f = _Fig(x, chao, H, espelho, uid)
    f.membro([(-0.075, 0.70), (-0.15, 0.585), (-0.125, 0.47)], 0.07, camisa); f.mao(-0.122, 0.448)       # braço de trás
    f.membro([(-0.02, 0.49), (-0.10, 0.27), (-0.19, 0.075)], 0.105, calca)                                # perna de trás
    f.elipse(-0.172, 0.04, 0.078, 0.034, giro=24)
    f.membro([(0.03, 0.49), (0.12, 0.27), (0.13, 0.055)], 0.105, calca)                                   # perna da frente
    f.elipse(0.188, 0.03, 0.088, 0.034)
    f.tronco((-0.10, 0.735), (0.0, 0.775), (0.115, 0.725), (0.105, 0.49), (0.01, 0.455), (-0.085, 0.50), camisa)
    f.cabeca(cabelo, oculos)
    if braco == "aceno":
        f.membro([(0.085, 0.70), (0.19, 0.76), (0.215, 0.905)], 0.07, camisa); f.mao(0.22, 0.945, True)
    elif braco == "bengala":
        f.linha([(0.225, 0.51), (0.43, 0.0)], 0.018)
        f.membro([(0.085, 0.70), (0.14, 0.585), (0.21, 0.52)], 0.07, camisa); f.mao(0.225, 0.51)
    else:
        f.membro([(0.085, 0.70), (0.15, 0.58), (0.215, 0.50)], 0.07, camisa); f.mao(0.232, 0.488)
    return f.svg()


def _sentada(x, chao, H, cabelo="longo", camisa="b", calca="b", espelho=False, uid="s"):
    f = _Fig(x, chao, H, espelho, uid)
    f.linha([(-0.13, 0.60), (-0.10, 0.30)], 0.03); f.linha([(-0.13, 0.60), (-0.21, 0.615)], 0.03)        # encosto e punho
    f.membro([(-0.02, 0.34), (0.20, 0.345), (0.235, 0.11)], 0.105, calca)                                 # coxa e canela
    f.elipse(0.288, 0.075, 0.084, 0.034); f.linha([(0.20, 0.04), (0.38, 0.04)], 0.022)                    # pé no apoio
    f.tronco((-0.095, 0.555), (0.0, 0.59), (0.11, 0.545), (0.10, 0.31), (0.0, 0.28), (-0.09, 0.31), camisa)
    wx, wy = f.P(-0.03, 0.205); R = 0.205 * H                                                             # roda grande
    f.o.append(f'<circle cx="{wx:.1f}" cy="{wy:.1f}" r="{R:.1f}" fill="#fff" stroke="#000" stroke-width="{0.038 * H:.1f}"/>')
    for i in range(5):
        a = math.radians(90 + i * 72)
        f.o.append(f'<path d="M{wx:.1f} {wy:.1f} L{wx + R * 0.86 * math.cos(a):.1f} {wy + R * 0.86 * math.sin(a):.1f}" {_ST} stroke="#000" stroke-width="{0.017 * H:.1f}"/>')
    f.disco(-0.03, 0.205, 0.03)
    cx, cy = f.P(0.255, 0.04)
    f.o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{0.036 * H:.1f}" fill="#fff" stroke="#000" stroke-width="{0.022 * H:.1f}"/>')
    f.membro([(-0.06, 0.52), (-0.115, 0.42), (-0.04, 0.395)], 0.07, camisa); f.mao(-0.03, 0.392)          # mão no aro
    f.cabeca(cabelo, dv=-0.19)
    f.membro([(0.09, 0.52), (0.20, 0.585), (0.235, 0.725)], 0.07, camisa); f.mao(0.24, 0.768, True)       # aceno
    return f.svg()


def _varal(x0, x1, y, barriga, n, larg, alt):
    corda = lambda x: y + barriga * 4 * ((x - x0) / (x1 - x0)) * (1 - (x - x0) / (x1 - x0))
    svg = f'<path d="M{x0} {y} Q {(x0 + x1) / 2} {y + 2 * barriga} {x1} {y}" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round"/>'
    xs = [x0 + (x1 - x0) * (i + 0.5) / n for i in range(n)]
    for i, x in enumerate(xs):
        yy = corda(x) + 2
        pts = [(x - larg / 2, yy), (x + larg / 2, yy), (x + (4 if i % 2 else -4), yy + alt)]
        cor = PRETO if i % 2 == 0 else 'fill="#fff"'
        svg += f'<polygon points="{_poli(pts)}" {cor} stroke="#000" stroke-width="9" stroke-linejoin="round"/>'
    return svg, [(x, corda(x) + 2) for i, x in enumerate(xs) if i % 2 == 0]


def _chao_cortes(p, rng, x0, x1, y0, n):
    y = y0
    for i in range(n):
        x = x0 + rng.uniform(0, 30)
        while x < x1 - 20:
            c = rng.uniform(50, 170)
            if rng.random() < 0.8:
                p.linha([(x, y), (min(x + c, x1 - 10), y + rng.uniform(-2, 2))], 9, "u")
            x += c + rng.uniform(18, 50)
        y += 22 + i * 3


# ---------- boas-vindas: três pessoas chegando, sem moldura ----------
def boas_vindas():
    chao, H = 800, 455
    svg = f'<rect x="60" y="{chao}" width="880" height="96" rx="10" {PRETO}/>'
    varal, pretas = _varal(60, 940, 105, 62, 9, 64, 84)
    svg += varal
    svg += _andando(215, chao + 6, H, cabelo="afro", camisa="w", calca="b", braco="aceno", uid="b1")
    svg += _sentada(485, chao + 6, H, cabelo="longo", camisa="b", uid="b2")
    svg += _andando(745, chao + 6, H, cabelo="coque", camisa="b", calca="w", braco="bengala", oculos=True, uid="b3")

    def cortes(p, rng):
        _chao_cortes(p, rng, 80, 920, chao + 34, 3)
        for (x, yy) in pretas:
            p.linha([(x - 11, yy + 14), (x - 4, yy + 46)], 8, "v")
    return dict(vb=(1000, 1000), svg=svg, cortes=cortes, falhas=0.7)


# ---------- cheguei, com figuras próprias: moldura, entrada com faixa, três pessoas chegando ----------
def _cheguei(cheia):
    chao, H = 838, 440
    svg = f'<rect x="38" y="38" width="924" height="924" rx="8" fill="none" stroke="#000" stroke-width="20"/>'
    svg += f'<rect x="46" y="{chao}" width="908" height="{954 - chao}" {PRETO}/>'
    svg += f'<rect x="72" y="118" width="36" height="{chao - 118}" {PRETO}/><rect x="892" y="118" width="36" height="{chao - 118}" {PRETO}/>'
    svg += '<path d="M66 132 Q500 104 934 132 L934 172 Q500 144 66 172Z" fill="#000"/>'      # faixa da entrada
    v1, p1 = _varal(108, 892, 196, 34, 11, 48, 62); v2, p2 = _varal(108, 892, 276, 30, 13, 40, 52)
    svg += v1 + v2
    figs = (_andando(232, chao + 5, H, cabelo="afro", camisa="w", calca="b", uid="c1")
            + _sentada(492, chao + 5, H, cabelo="longo", camisa="b", uid="c2")
            + _andando(752, chao + 5, H, cabelo="coque", camisa="b", calca="b", uid="c3"))
    svg += figs

    def cortes(p, rng):
        _chao_cortes(p, rng, 66, 934, chao + 30, 4)
        for j in range(1, 32):                                          # zigue-zague da faixa
            x = 66 + j * 27.1; t = (x - 66) / 868; yc = 152 - 28 * 4 * t * (1 - t) / 2 + 14 * 4 * t * (1 - t) * 0 - 14 * 4 * t * (1 - t) + 14 * 4 * t * (1 - t)
            yc = 152 - 14 * 4 * t * (1 - t)
            hh = 11 if j % 2 else -11
            p.poligono([(x - 10, yc - hh), (x + 10, yc - hh), (x, yc + hh)])
        for (x, yy) in p1 + p2:
            p.linha([(x - 8, yy + 10), (x - 3, yy + 34)], 6, "v")
        for px in (84, 96, 904, 916):                                   # veio dos postes
            y = 200 + rng.uniform(0, 40)
            while y < chao - 60:
                c = rng.uniform(60, 150); p.linha([(px, y), (px + rng.uniform(-2, 2), y + c)], 6, "v"); y += c + rng.uniform(20, 50)
    d = dict(vb=(1000, 1000), svg=svg, cortes=cortes, falhas=0.7)
    if cheia:
        d["fundo"] = (58, 58, 942, chao); d["silhuetas"] = figs + v1 + v2
    return d


def cheguei_cheia():
    return _cheguei(True)


def cheguei_miniatura():
    return _cheguei(False)


PECAS = {
    "faixa-bandeirolas": (bandeirolas, 1280, "Faixa de bandeirolas, divisória"),
    "ingresso": (ingresso, 1024, "Ingresso com picote e estrela"),
    "nada-por-aqui": (nada_por_aqui, 1024, "Mandacaru sob o sol, para telas vazias"),
    "sem-internet": (sem_internet, 1024, "Jangada parada no mar calmo, para quando falta internet"),
    "algo-deu-errado": (algo_deu_errado, 1024, "Pipa enroscada no fio, para erros"),
    "tudo-pronto": (tudo_pronto, 1024, "Sol nascendo sob bandeirolas, para confirmações"),
    "boas-vindas": (boas_vindas, 1024, "Três pessoas chegando sob as bandeirolas, para a abertura do app"),
    "cheguei": (cheguei_cheia, 1024, "Cheguei: três pessoas chegando ao evento, fundo talhado"),
    "cheguei-miniatura": (cheguei_miniatura, 1024, "Cheguei: três pessoas chegando ao evento, traço limpo"),
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
