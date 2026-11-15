/**
 * Paleta fechada da aparência do evento (ADR 0011 e 0029). O organizador escolhe
 * o nome de duas cores; o valor de cada uma em cada tema mora aqui e é conferido
 * pelo teste de contraste. Assim nenhuma escolha consegue deixar um texto ilegível.
 *
 * `fundo` é a cor da marca (botão, faixa do topo); `texto` é o que se escreve sobre ela.
 */
import type { Tema } from './tokens.ts';

export const nomesDaPaleta = ['azul', 'verde', 'vinho', 'laranja', 'roxo', 'grafite', 'petroleo', 'terracota'] as const;
export type NomeDaPaleta = (typeof nomesDaPaleta)[number];

export interface CorDaPaleta {
  readonly fundo: string;
  readonly texto: string;
}

const ESCURO = '#0e1615';
const CLARO = '#ffffff';

export const paleta: Readonly<Record<Tema, Readonly<Record<NomeDaPaleta, CorDaPaleta>>>> = {
  light: {
    azul: { fundo: '#1d4ed8', texto: CLARO },
    verde: { fundo: '#17663a', texto: CLARO },
    vinho: { fundo: '#8a1c3c', texto: CLARO },
    laranja: { fundo: '#a84300', texto: CLARO },
    roxo: { fundo: '#6b2fb3', texto: CLARO },
    grafite: { fundo: '#37424a', texto: CLARO },
    petroleo: { fundo: '#0a5c69', texto: CLARO },
    terracota: { fundo: '#9c3d22', texto: CLARO },
  },
  dark: {
    azul: { fundo: '#8ab4ff', texto: ESCURO },
    verde: { fundo: '#7ee0aa', texto: ESCURO },
    vinho: { fundo: '#ff9db5', texto: ESCURO },
    laranja: { fundo: '#ffb37a', texto: ESCURO },
    roxo: { fundo: '#c9a6ff', texto: ESCURO },
    grafite: { fundo: '#c3cdd3', texto: ESCURO },
    petroleo: { fundo: '#6fd0dd', texto: ESCURO },
    terracota: { fundo: '#f2a48c', texto: ESCURO },
  },
  // Alto contraste: fundo branco, então cada cor fica bem escura, com texto branco (7:1 ou mais).
  'alto-contraste': {
    azul: { fundo: '#0b2e8a', texto: CLARO },
    verde: { fundo: '#0a4424', texto: CLARO },
    vinho: { fundo: '#5c0f26', texto: CLARO },
    laranja: { fundo: '#6b2a00', texto: CLARO },
    roxo: { fundo: '#43187a', texto: CLARO },
    grafite: { fundo: '#1f272c', texto: CLARO },
    petroleo: { fundo: '#003a43', texto: CLARO },
    terracota: { fundo: '#63230f', texto: CLARO },
  },
};

/** Cor da paleta pelo nome guardado na API; nome desconhecido (ou ausente) cai no padrão do app. */
export function corDaPaleta(tema: Tema, nome: unknown, padrao: NomeDaPaleta = 'petroleo'): CorDaPaleta {
  const chave = (nomesDaPaleta as readonly unknown[]).includes(nome) ? (nome as NomeDaPaleta) : padrao;
  return paleta[tema][chave];
}
