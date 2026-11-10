#!/usr/bin/env bash
# Captura as telas e os fluxos do app no emulador ou celular Android (adb),
# para a documentação. Uso, com o app aberto pelo `npm run dev`:
#
#   bash scripts/capturas.sh            # telas e fluxos
#   bash scripts/capturas.sh telas      # só as telas
#   bash scripts/capturas.sh fluxos     # só os fluxos animados
#
# Precisa de adb (Android SDK). Para os GIFs, também de ffmpeg.
# Os arquivos vão para docs/imagens/. A barra de status fica limpa (09:41,
# bateria cheia, sem notificações) durante a captura e volta ao normal no fim.
set -euo pipefail

DESTINO="$(cd "$(dirname "$0")/.." && pwd)/docs/imagens"
mkdir -p "$DESTINO"

command -v adb >/dev/null || { echo "Instale o adb (Android SDK platform-tools)."; exit 1; }
[ "$(adb devices | grep -c 'device$')" -ge 1 ] || { echo "Nenhum emulador ou celular conectado (adb devices)."; exit 1; }

demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
limpar_barra() {
  adb shell settings put global sysui_demo_allowed 1
  demo enter
  demo clock -e hhmm 0941
  demo battery -e level 100 -e plugged false
  demo network -e wifi show -e level 4 -e mobile hide
  demo notifications -e visible false
}
restaurar_barra() { demo exit || true; }
trap restaurar_barra EXIT

tela() {
  local nome="$1" instrucao="$2"
  read -r -p "→ $instrucao  [Enter para capturar, s para pular] " r
  [ "$r" = "s" ] && return
  adb exec-out screencap -p > "$DESTINO/$nome.png"
  echo "  salvo: docs/imagens/$nome.png"
}

fluxo() {
  local nome="$1" segundos="$2" instrucao="$3"
  command -v ffmpeg >/dev/null || { echo "  (sem ffmpeg: pulei $nome.gif)"; return; }
  read -r -p "→ $instrucao  Enter inicia a gravação de ${segundos}s; faça o fluxo devagar. [s pula] " r
  [ "$r" = "s" ] && return
  adb shell rm -f /sdcard/captura.mp4
  adb shell screenrecord --time-limit "$segundos" --size 720x1600 /sdcard/captura.mp4 || true
  adb pull -q /sdcard/captura.mp4 "$DESTINO/$nome.mp4"
  # GIF leve para o README: 12 quadros por segundo, 320 px de largura, paleta própria.
  ffmpeg -loglevel error -y -i "$DESTINO/$nome.mp4" -vf "fps=12,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer" "$DESTINO/$nome.gif"
  rm -f "$DESTINO/$nome.mp4"
  echo "  salvo: docs/imagens/$nome.gif ($(du -h "$DESTINO/$nome.gif" | cut -f1))"
}

limpar_barra
modo="${1:-tudo}"

if [ "$modo" != "fluxos" ]; then
  echo "== Telas (participante) =="
  tela 01-entrar        "Abra a tela Entrar (saia da conta se precisar)."
  tela 02-eventos       "Toque em 'Ver eventos sem entrar'."
  tela 03-evento        "Abra 'Simulação Acessa Evento'."
  tela 04-ingresso-tipo "Entre, toque em Inscrever-se e fique na escolha do ingresso (com 'Lote esgotado' visível)."
  tela 05-acessibilidade "Avance para 'Precisa de algum recurso?' e marque Intérprete de Libras."
  tela 06-pagamento     "Avance para Pagamento, com o aviso de ambiente de teste."
  tela 07-agenda        "Conclua e abra a aba Agenda (com o atalho do ingresso no topo)."
  tela 08-detalhe       "Abra uma sessão com selo de Libras."
  tela 09-ingresso      "Abra a aba Ingresso (QR na tela)."
  tela 10-assistente    "Ajuda → Assistente do evento."
  tela 11-resposta      "Acessibilidade → Intérprete de Libras."
  tela 12-alto-contraste "Ajuda → Alto contraste: Sempre ligado; volte à Agenda."
  echo "== Telas (equipe, com npm run dev -- --equipe seu@email) =="
  tela 13-credenciamento "Ajuda → Credenciamento (início, com a fila)."
  tela 14-pode-entrar   "Leia o QR de um participante: 'Pode entrar'."
  tela 15-ja-entrou     "Leia o mesmo QR de novo: 'Já entrou hoje'."
fi

if [ "$modo" != "telas" ]; then
  echo "== Fluxos animados =="
  fluxo fluxo-inscricao 25 "Comece em Eventos e faça a inscrição até 'Você está no…'."
  fluxo fluxo-agenda    15 "Na Agenda: troque de dia, ligue o filtro Libras, favorite uma sessão."
  fluxo fluxo-checkin   20 "No Credenciamento, em modo avião: leia um QR, depois o mesmo de novo."
  fluxo fluxo-assistente 15 "No Assistente: Acessibilidade → Intérprete de Libras → Não → canais."
fi

echo "Pronto. Arquivos em docs/imagens/."
