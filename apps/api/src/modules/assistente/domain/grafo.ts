/**
 * Grafo do assistente guiado (ADR 0008 e 0023). Puro.
 *
 * Cada nó é uma pergunta (2 a 8 opções, cada uma levando a outro nó) ou uma
 * resposta revisada pela organização, com data. Sem ciclos e com no máximo
 * 6 perguntas seguidas: ninguém fica rodando em círculo.
 */
export interface Opcao {
  readonly rotulo: string;
  readonly destino: string;
}

export interface Pergunta {
  readonly tipo: 'pergunta';
  readonly texto: string;
  readonly opcoes: readonly Opcao[];
}

export interface Resposta {
  readonly tipo: 'resposta';
  readonly titulo: string;
  readonly texto: string;
  /** Data da última revisão (AAAA-MM-DD), mostrada junto da resposta. */
  readonly revisadaEm: string;
}

export interface Grafo {
  readonly inicio: string;
  readonly nos: Readonly<Record<string, Pergunta | Resposta>>;
}

export interface Canal {
  readonly tipo: 'telefone' | 'whatsapp' | 'email' | 'balcao';
  readonly rotulo: string;
  readonly valor: string;
}

export interface Assistente {
  readonly versao: number;
  readonly grafo: Grafo;
  readonly canais: readonly Canal[];
  readonly publicadoEm: string;
}

export class ErroGrafo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroGrafo';
  }
}

const ID = /^[a-z0-9-]{1,40}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const MAXIMO_NOS = 300;
export const MAXIMO_PERGUNTAS_SEGUIDAS = 6;

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function texto(v: unknown, onde: string, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ErroGrafo(`${onde}: texto obrigatório, até ${max} caracteres.`);
  return v.trim();
}

function no(id: string, v: unknown): Pergunta | Resposta {
  if (!objeto(v)) throw new ErroGrafo(`Nó "${id}" inválido.`);
  if (v['tipo'] === 'pergunta') {
    const opcoes = v['opcoes'];
    if (!Array.isArray(opcoes) || opcoes.length < 2 || opcoes.length > 8) throw new ErroGrafo(`Pergunta "${id}": use de 2 a 8 opções.`);
    return {
      tipo: 'pergunta',
      texto: texto(v['texto'], `Pergunta "${id}"`, 200),
      opcoes: opcoes.map((o: unknown, i) => {
        if (!objeto(o) || typeof o['destino'] !== 'string' || !ID.test(o['destino'])) throw new ErroGrafo(`Pergunta "${id}", opção ${i + 1}: destino inválido.`);
        return { rotulo: texto(o['rotulo'], `Pergunta "${id}", opção ${i + 1}`, 80), destino: o['destino'] };
      }),
    };
  }
  if (v['tipo'] === 'resposta') {
    const revisada = v['revisadaEm'];
    if (typeof revisada !== 'string' || !DATA.test(revisada) || Number.isNaN(Date.parse(revisada))) throw new ErroGrafo(`Resposta "${id}": informe revisadaEm (AAAA-MM-DD).`);
    return { tipo: 'resposta', titulo: texto(v['titulo'], `Resposta "${id}"`, 120), texto: texto(v['texto'], `Resposta "${id}"`, 2000), revisadaEm: revisada };
  }
  throw new ErroGrafo(`Nó "${id}": tipo deve ser "pergunta" ou "resposta".`);
}

/** Valida e normaliza. Exige que todo nó seja alcançável a partir do início. */
export function validarGrafo(v: unknown): Grafo {
  if (!objeto(v) || !objeto(v['nos'])) throw new ErroGrafo('Envie o grafo com "inicio" e "nos".');
  const entradas = Object.entries(v['nos']);
  if (entradas.length === 0 || entradas.length > MAXIMO_NOS) throw new ErroGrafo(`O grafo precisa ter de 1 a ${MAXIMO_NOS} nós.`);
  const nos: Record<string, Pergunta | Resposta> = {};
  for (const [id, valor] of entradas) {
    if (!ID.test(id)) throw new ErroGrafo(`Id "${id}" inválido: use letras minúsculas, números e hífen.`);
    nos[id] = no(id, valor);
  }
  const inicio = v['inicio'];
  if (typeof inicio !== 'string' || !nos[inicio]) throw new ErroGrafo('O início precisa apontar para um nó existente.');
  if (nos[inicio]?.tipo !== 'pergunta') throw new ErroGrafo('O início precisa ser uma pergunta.');

  for (const [id, n] of Object.entries(nos)) {
    if (n.tipo === 'pergunta') {
      for (const o of n.opcoes) if (!nos[o.destino]) throw new ErroGrafo(`Pergunta "${id}": a opção "${o.rotulo}" leva a "${o.destino}", que não existe.`);
    }
  }

  // Busca em profundidade: acha ciclos, mede a maior sequência de perguntas e marca os alcançáveis.
  const visitando = new Set<string>();
  const profundidade = new Map<string, number>();
  const visitar = (id: string): number => {
    const memo = profundidade.get(id);
    if (memo !== undefined) return memo;
    if (visitando.has(id)) throw new ErroGrafo(`O grafo tem um ciclo passando por "${id}".`);
    const n = nos[id];
    let p = 0;
    if (n?.tipo === 'pergunta') {
      visitando.add(id);
      p = 1 + Math.max(...n.opcoes.map((o) => visitar(o.destino)));
      visitando.delete(id);
    }
    profundidade.set(id, p);
    return p;
  };
  if (visitar(inicio) > MAXIMO_PERGUNTAS_SEGUIDAS) throw new ErroGrafo(`Há caminhos com mais de ${MAXIMO_PERGUNTAS_SEGUIDAS} perguntas seguidas.`);
  const soltos = Object.keys(nos).filter((id) => !profundidade.has(id));
  if (soltos.length) throw new ErroGrafo(`Nós que ninguém alcança: ${soltos.join(', ')}.`);
  return { inicio, nos };
}

export function validarCanais(v: unknown): Canal[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 6) throw new ErroGrafo('Informe de 1 a 6 canais de atendimento.');
  return v.map((c: unknown, i) => {
    if (!objeto(c) || !['telefone', 'whatsapp', 'email', 'balcao'].includes(c['tipo'] as string)) throw new ErroGrafo(`Canal ${i + 1}: tipo inválido.`);
    const tipo = c['tipo'] as Canal['tipo'];
    const valor = texto(c['valor'], `Canal ${i + 1}`, 120);
    if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) throw new ErroGrafo(`Canal ${i + 1}: e-mail inválido.`);
    if ((tipo === 'telefone' || tipo === 'whatsapp') && !/^\+?[0-9 ()-]{8,20}$/.test(valor)) throw new ErroGrafo(`Canal ${i + 1}: telefone inválido.`);
    return { tipo, rotulo: texto(c['rotulo'], `Canal ${i + 1}`, 60), valor };
  });
}

export function eResposta(grafo: Grafo, id: string): boolean {
  return grafo.nos[id]?.tipo === 'resposta';
}
