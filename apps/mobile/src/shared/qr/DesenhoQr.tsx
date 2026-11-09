/**
 * Desenha um QR com Views, sem SVG nem imagem. A geração da matriz usa
 * qrcode-generator (sem dependências), isolada aqui.
 * Fundo branco e margem de 4 módulos em qualquer tema: leitores precisam disso.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import qrcode from 'qrcode-generator';

export function matrizQr(texto: string): boolean[][] {
  const q = qrcode(0, 'M');
  q.addData(texto, 'Byte');
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, l) => Array.from({ length: n }, (_, c) => q.isDark(l, c)));
}

/** Junta módulos escuros vizinhos da mesma linha num só retângulo. */
export function faixas(linha: readonly boolean[]): { inicio: number; tamanho: number }[] {
  const r: { inicio: number; tamanho: number }[] = [];
  let inicio = -1;
  linha.forEach((escuro, i) => {
    if (escuro && inicio < 0) inicio = i;
    if ((!escuro || i === linha.length - 1) && inicio >= 0) {
      const fim = escuro ? i + 1 : i;
      r.push({ inicio, tamanho: fim - inicio });
      inicio = -1;
    }
  });
  return r;
}

interface Props {
  readonly valor: string;
  readonly tamanho: number;
  readonly rotulo: string;
}

const MARGEM = 4;

export function DesenhoQr({ valor, tamanho, rotulo }: Props) {
  const matriz = useMemo(() => matrizQr(valor), [valor]);
  const modulo = tamanho / (matriz.length + MARGEM * 2);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotulo}
      style={{ width: tamanho, height: tamanho, backgroundColor: '#FFFFFF', padding: modulo * MARGEM }}
    >
      {matriz.map((linha, l) => (
        <View key={l} style={{ height: modulo, flexDirection: 'row' }}>
          {faixas(linha).map((f) => (
            <View key={f.inicio} style={{ position: 'absolute', left: f.inicio * modulo, width: f.tamanho * modulo, height: modulo, backgroundColor: '#000000' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
