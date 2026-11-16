/**
 * Gravura da carteira de xilos (ADR 0031): máscara PNG colorida pelo tema com
 * tintColor. Peça que informa algo leva o texto alternativo do manifesto; peça
 * de enfeite fica fora do leitor de tela.
 */
import { Image } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { xilos } from '@acessa-evento/xilos';
import { useTema } from '../tema/TemaProvider';

/* eslint-disable @typescript-eslint/no-require-imports -- imagem estática: o empacotador só resolve com require literal. */
const MASCARAS = {
  boasVindas: { fonte: require('@acessa-evento/xilos/png/boas-vindas.png') as ImageSourcePropType, proporcao: 1 },
  chegueiMiniatura: { fonte: require('@acessa-evento/xilos/png/cheguei-miniatura.png') as ImageSourcePropType, proporcao: 1 },
  nadaPorAqui: { fonte: require('@acessa-evento/xilos/png/nada-por-aqui.png') as ImageSourcePropType, proporcao: 1 },
  semInternet: { fonte: require('@acessa-evento/xilos/png/sem-internet.png') as ImageSourcePropType, proporcao: 1 },
  algoDeuErrado: { fonte: require('@acessa-evento/xilos/png/algo-deu-errado.png') as ImageSourcePropType, proporcao: 1 },
  tudoPronto: { fonte: require('@acessa-evento/xilos/png/tudo-pronto.png') as ImageSourcePropType, proporcao: 1 },
  ingresso: { fonte: require('@acessa-evento/xilos/png/ingresso.png') as ImageSourcePropType, proporcao: 1 },
  faixaBandeirolas: { fonte: require('@acessa-evento/xilos/png/faixa-bandeirolas.png') as ImageSourcePropType, proporcao: 640 / 104 },
  simboloLibras: { fonte: require('@acessa-evento/xilos/png/simbolo-libras.png') as ImageSourcePropType, proporcao: 1 },
  simboloIngresso: { fonte: require('@acessa-evento/xilos/png/simbolo-ingresso.png') as ImageSourcePropType, proporcao: 1 },
  simboloLegenda: { fonte: require('@acessa-evento/xilos/png/simbolo-legenda.png') as ImageSourcePropType, proporcao: 1 },
  simboloAudiodescricao: { fonte: require('@acessa-evento/xilos/png/simbolo-audiodescricao.png') as ImageSourcePropType, proporcao: 1 },
  simboloSemDegraus: { fonte: require('@acessa-evento/xilos/png/simbolo-sem-degraus.png') as ImageSourcePropType, proporcao: 1 },
  simboloFavorito: { fonte: require('@acessa-evento/xilos/png/simbolo-favorito.png') as ImageSourcePropType, proporcao: 1 },
  simboloAviso: { fonte: require('@acessa-evento/xilos/png/simbolo-aviso.png') as ImageSourcePropType, proporcao: 1 },
  simboloMapa: { fonte: require('@acessa-evento/xilos/png/simbolo-mapa.png') as ImageSourcePropType, proporcao: 1 },
  simboloCamera: { fonte: require('@acessa-evento/xilos/png/simbolo-camera.png') as ImageSourcePropType, proporcao: 1 },
  simboloPrivacidade: { fonte: require('@acessa-evento/xilos/png/simbolo-privacidade.png') as ImageSourcePropType, proporcao: 1 },
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type NomeXilo = keyof typeof MASCARAS;

interface Props {
  readonly nome: NomeXilo;
  /** Largura em pontos; a altura segue a proporção da peça. */
  readonly largura: number;
  /** Cor da tinta; o padrão é a cor da marca no tema atual. */
  readonly cor?: string;
  /** Enfeite: o texto ao lado já diz tudo, então o leitor de tela pula a imagem. */
  readonly decorativa?: boolean;
}

export function Xilo({ nome, largura, cor, decorativa = false }: Props) {
  const { cores } = useTema();
  const { fonte, proporcao } = MASCARAS[nome];
  const estilo = { width: largura, height: largura / proporcao, tintColor: cor ?? cores.primary600 };
  if (decorativa) {
    return <Image source={fonte} style={estilo} resizeMode="contain" testID={`xilo-${nome}`} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
  }
  return <Image source={fonte} style={estilo} resizeMode="contain" accessible accessibilityRole="image" accessibilityLabel={xilos[nome].alt} />;
}

export const NOMES_DE_XILO = Object.keys(MASCARAS) as NomeXilo[];
