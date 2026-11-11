/**
 * Carteira de xilos: a lista das gravuras do app, com o uso de cada uma e o texto alternativo.
 * Os arquivos ficam em ../svg; cada um é um único traçado em currentColor, então segue o tema.
 */

/** cena: gravura com pessoas; estado: tela vazia, sem internet, erro; objeto: peça solta; simbolo: 24 px. */
export type Familia = 'cena' | 'estado' | 'objeto' | 'simbolo';

export interface Xilo {
  readonly arquivo: string;
  readonly familia: Familia;
  /** Onde a peça entra no app. */
  readonly uso: string;
  /** Texto para leitor de tela quando a peça informa algo; se for só enfeite, a tela a esconde. */
  readonly alt: string;
}

/** Peso máximo do arquivo, em bytes, por família. */
export const LIMITE_BYTES: Readonly<Record<Familia, number>> = {
  cena: 150 * 1024,
  estado: 45 * 1024,
  objeto: 45 * 1024,
  simbolo: 4 * 1024,
};

export const xilos = {
  cheguei: {
    arquivo: 'cheguei.svg',
    familia: 'cena',
    uso: 'Check-in confirmado, com fundo talhado.',
    alt: 'Três pessoas chegando a um evento sob bandeirolas: duas caminhando e uma em cadeira de rodas, acenando.',
  },
  chegueiMiniatura: {
    arquivo: 'cheguei-miniatura.svg',
    familia: 'cena',
    uso: 'A mesma cena em traço limpo, para tamanhos pequenos.',
    alt: 'Três pessoas chegando a um evento sob bandeirolas: duas caminhando e uma em cadeira de rodas, acenando.',
  },
  boasVindas: {
    arquivo: 'boas-vindas.svg',
    familia: 'cena',
    uso: 'Abertura do app, antes de qualquer evento.',
    alt: 'Três pessoas chegando sob bandeirolas: uma acenando, uma em cadeira de rodas acenando e uma cega, de óculos escuros e bengala.',
  },
  nadaPorAqui: {
    arquivo: 'nada-por-aqui.svg',
    familia: 'estado',
    uso: 'Telas vazias: sem sessões, sem favoritos, sem resultados.',
    alt: 'Um mandacaru sozinho sob o sol.',
  },
  semInternet: {
    arquivo: 'sem-internet.svg',
    familia: 'estado',
    uso: 'Aviso de que o app está sem internet.',
    alt: 'Uma jangada parada no mar calmo.',
  },
  ingresso: {
    arquivo: 'ingresso.svg',
    familia: 'objeto',
    uso: 'Destaque do ingresso: confirmação de inscrição e verso do bilhete.',
    alt: 'Um ingresso com picote e uma estrela.',
  },
  faixaBandeirolas: {
    arquivo: 'faixa-bandeirolas.svg',
    familia: 'objeto',
    uso: 'Divisória entre blocos. Sempre larga, nunca como ícone.',
    alt: 'Faixa de bandeirolas.',
  },
  simboloLibras: {
    arquivo: 'simbolo-libras.svg',
    familia: 'simbolo',
    uso: 'Selo de Libras, sempre ao lado da palavra "Libras".',
    alt: 'Libras',
  },
  simboloIngresso: {
    arquivo: 'simbolo-ingresso.svg',
    familia: 'simbolo',
    uso: 'Aba Ingresso na navegação, sempre com o rótulo.',
    alt: 'Ingresso',
  },
  algoDeuErrado: {
    arquivo: 'algo-deu-errado.svg',
    familia: 'estado',
    uso: 'Erros: algo falhou e a pessoa pode tentar de novo.',
    alt: 'Uma pipa enroscada no fio de um poste.',
  },
  tudoPronto: {
    arquivo: 'tudo-pronto.svg',
    familia: 'estado',
    uso: 'Confirmações: inscrição feita, evento publicado, contrato assinado.',
    alt: 'O sol nascendo sob uma faixa de bandeirolas.',
  },
  simboloLegenda: {
    arquivo: 'simbolo-legenda.svg',
    familia: 'simbolo',
    uso: 'Selo de legenda, sempre ao lado da palavra "Legenda".',
    alt: 'Legenda',
  },
  simboloAudiodescricao: {
    arquivo: 'simbolo-audiodescricao.svg',
    familia: 'simbolo',
    uso: 'Selo de audiodescrição, sempre ao lado da palavra "Audiodescrição".',
    alt: 'Audiodescrição',
  },
  simboloSemDegraus: {
    arquivo: 'simbolo-sem-degraus.svg',
    familia: 'simbolo',
    uso: 'Acesso sem degraus, sempre com o texto "Sem degraus" ou "Por elevador".',
    alt: 'Acesso sem degraus',
  },
  simboloFavorito: {
    arquivo: 'simbolo-favorito.svg',
    familia: 'simbolo',
    uso: 'Favoritar uma sessão. O botão leva o nome da sessão.',
    alt: 'Favorito',
  },
  simboloAviso: {
    arquivo: 'simbolo-aviso.svg',
    familia: 'simbolo',
    uso: 'Avisos da organização e pedido de permissão para notificações.',
    alt: 'Avisos',
  },
  simboloMapa: {
    arquivo: 'simbolo-mapa.svg',
    familia: 'simbolo',
    uso: 'Local do evento, salas e estandes.',
    alt: 'Local',
  },
  simboloCamera: {
    arquivo: 'simbolo-camera.svg',
    familia: 'simbolo',
    uso: 'Pedido de permissão da câmera e leitor de QR.',
    alt: 'Câmera',
  },
  simboloPrivacidade: {
    arquivo: 'simbolo-privacidade.svg',
    familia: 'simbolo',
    uso: 'Privacidade: o que o app guarda e apaga.',
    alt: 'Privacidade',
  },
} as const satisfies Record<string, Xilo>;

export type NomeXilo = keyof typeof xilos;
