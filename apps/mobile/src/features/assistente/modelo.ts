/** Tipos e regras puras do assistente guiado no app (feature 05). */
export interface Opcao { readonly rotulo: string; readonly destino: string }
export interface Pergunta { readonly tipo: 'pergunta'; readonly texto: string; readonly opcoes: readonly Opcao[] }
export interface Resposta { readonly tipo: 'resposta'; readonly titulo: string; readonly texto: string; readonly revisadaEm: string }
export interface Grafo { readonly inicio: string; readonly nos: Readonly<Record<string, Pergunta | Resposta>> }
export interface Canal { readonly tipo: 'telefone' | 'whatsapp' | 'email' | 'balcao'; readonly rotulo: string; readonly valor: string }
export interface Assistente { readonly versao: number; readonly grafo: Grafo; readonly canais: readonly Canal[]; readonly publicadoEm: string }

/** Quantas perguntas ainda faltam, contando a deste nó, no caminho mais longo. */
export function perguntasRestantes(grafo: Grafo, id: string, memo = new Map<string, number>(), visitando = new Set<string>()): number {
  const salvo = memo.get(id);
  if (salvo !== undefined) return salvo;
  const no = grafo.nos[id];
  if (!no || no.tipo === 'resposta' || visitando.has(id)) return 0;
  visitando.add(id);
  const r = 1 + Math.max(0, ...no.opcoes.map((o) => perguntasRestantes(grafo, o.destino, memo, visitando)));
  visitando.delete(id);
  memo.set(id, r);
  return r;
}

/** "Pergunta 2 de 2": a posição e o total do caminho mais longo a partir daqui. */
export function progresso(grafo: Grafo, id: string, respondidas: number): { atual: number; total: number } {
  const atual = respondidas + 1;
  return { atual, total: respondidas + perguntasRestantes(grafo, id) };
}

export function dataRevisao(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00Z`));
}

/** Link de cada canal; o balcão não tem link. */
export function linkCanal(c: Canal): string | null {
  const digitos = c.valor.replace(/\D/g, '');
  if (c.tipo === 'email') return `mailto:${c.valor}`;
  if (c.tipo === 'telefone') return `tel:+${digitos}`;
  if (c.tipo === 'whatsapp') return `https://wa.me/${digitos}`;
  return null;
}
