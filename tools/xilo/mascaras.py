"""Gera as máscaras PNG das xilos para o app (ADR 0031).

Cada máscara é a gravura em branco opaco sobre transparente; o app colore com
tintColor pelo tema. Uso: python3 tools/xilo/mascaras.py
"""
import hashlib
import io
import json
import pathlib

import cairosvg
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parents[2] / "packages" / "xilos"
SVG, PNG = RAIZ / "svg", RAIZ / "png"

# Largura em pixels por família, para a maior exibição em tela de 3x.
LARGURA = {"cena": 960, "estado": 640, "objeto": 640, "simbolo": 96}

# Peças que entram no app e a família de cada uma. "cheguei" (fundo talhado) fica de fora: é a mais pesada.
PECAS = {
    "boas-vindas": "cena",
    "cheguei-miniatura": "cena",
    "nada-por-aqui": "estado",
    "sem-internet": "estado",
    "algo-deu-errado": "estado",
    "tudo-pronto": "estado",
    "ingresso": "objeto",
    "faixa-bandeirolas": "objeto",
    "simbolo-libras": "simbolo",
    "simbolo-ingresso": "simbolo",
    "simbolo-legenda": "simbolo",
    "simbolo-audiodescricao": "simbolo",
    "simbolo-sem-degraus": "simbolo",
    "simbolo-favorito": "simbolo",
    "simbolo-aviso": "simbolo",
    "simbolo-mapa": "simbolo",
    "simbolo-camera": "simbolo",
    "simbolo-privacidade": "simbolo",
}


def mascara(nome: str, familia: str) -> dict:
    svg = (SVG / f"{nome}.svg").read_bytes()
    # currentColor vira branco: o que importa é o alfa.
    bruto = cairosvg.svg2png(bytestring=svg.replace(b"currentColor", b"#ffffff"), output_width=LARGURA[familia])
    alfa = Image.open(io.BytesIO(bruto)).convert("RGBA").getchannel("A")
    # Cinza com alfa: um terço do peso do RGBA, e o tintColor só lê o alfa.
    imagem = Image.merge("LA", (Image.new("L", alfa.size, 255), alfa))
    destino = PNG / f"{nome}.png"
    imagem.save(destino, optimize=True)
    return {"largura": imagem.width, "altura": imagem.height, "familia": familia, "svg": hashlib.sha256(svg).hexdigest()[:16]}


def main() -> None:
    PNG.mkdir(exist_ok=True)
    for antigo in PNG.glob("*.png"):
        antigo.unlink()
    indice = {nome: mascara(nome, familia) for nome, familia in sorted(PECAS.items())}
    (PNG / "mascaras.json").write_text(json.dumps(indice, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum((PNG / f"{n}.png").stat().st_size for n in indice)
    print(f"{len(indice)} máscaras, {total / 1024:.0f} kB no total")


if __name__ == "__main__":
    main()
