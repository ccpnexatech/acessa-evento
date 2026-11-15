/** Regras puras da feira, do portal do expositor e dos contratos (feature 10, ADR 0028). Sem I/O. */
import { ErroDominio } from '../../../shared/dominio/erro.ts';
import { validarCampos } from '../../cadastros/domain/campos.ts';
import type { Campos, Valores } from '../../cadastros/domain/campos.ts';

const invalido = (m: string) => new ErroDominio('dados_invalidos', m);

const CAMPOS_PERFIL: Campos = {
  nomeExibicao: { tipo: 'texto', rotulo: 'Nome no app', min: 2, max: 80, obrigatorio: true },
  logoUrl: { tipo: 'url', rotulo: 'Logo' },
  logoDescricao: { tipo: 'texto', rotulo: 'Descrição do logo', min: 3, max: 160 },
  segmentoId: { tipo: 'uuid', rotulo: 'Segmento' },
  frase: { tipo: 'texto', rotulo: 'Frase', max: 140 },
  destaques: { tipo: 'textos', rotulo: 'Destaques', max: 60, maxItens: 5 },
  site: { tipo: 'url', rotulo: 'Site' },
  contato: { tipo: 'texto', rotulo: 'Contato', max: 120 },
  publicado: { tipo: 'booleano', rotulo: 'Publicado' },
};

/** Perfil da marca: enviado inteiro. Logo sem descrição ficaria mudo no leitor de tela. */
export function validarPerfil(corpo: unknown): Valores {
  const v = validarCampos(CAMPOS_PERFIL, corpo, 'criar');
  if (v['logoUrl'] && !v['logoDescricao']) throw invalido('Descrição do logo: descreva o logo para quem usa leitor de tela.');
  return {
    nomeExibicao: v['nomeExibicao'] ?? null, logoUrl: v['logoUrl'] ?? null, logoDescricao: v['logoUrl'] ? v['logoDescricao'] ?? null : null,
    segmentoId: v['segmentoId'] ?? null, frase: v['frase'] ?? null, destaques: v['destaques'] ?? [], site: v['site'] ?? null,
    contato: v['contato'] ?? null, publicado: v['publicado'] ?? false,
  };
}

const CAMPOS_MONTAGEM: Campos = {
  tipo: { tipo: 'opcao', rotulo: 'Tipo de montagem', opcoes: ['basica', 'montadora_propria', 'estande_diferente'], obrigatorio: true },
  montadora: { tipo: 'texto', rotulo: 'Montadora', max: 120 },
  projetoUrl: { tipo: 'url', rotulo: 'Projeto' },
  artRrt: { tipo: 'texto', rotulo: 'ART ou RRT', max: 40 },
  termoAceito: { tipo: 'booleano', rotulo: 'Termo de responsabilidade' },
};

export interface DadosMontagem {
  readonly tipo: string; readonly montadora: string | null; readonly projetoUrl: string | null;
  readonly artRrt: string | null; readonly termoAceito: boolean;
}

export function validarMontagem(corpo: unknown): DadosMontagem {
  const v = validarCampos(CAMPOS_MONTAGEM, corpo, 'criar');
  const basica = v['tipo'] === 'basica';
  // Montagem básica é a da feira: não tem montadora, projeto nem termo.
  return {
    tipo: v['tipo'] as string,
    montadora: basica ? null : (v['montadora'] as string | undefined) ?? null,
    projetoUrl: basica ? null : (v['projetoUrl'] as string | undefined) ?? null,
    artRrt: basica ? null : (v['artRrt'] as string | undefined) ?? null,
    termoAceito: !basica && v['termoAceito'] === true,
  };
}

export function validarQuantidade(corpo: unknown): number {
  const q = (corpo as { quantidade?: unknown } | null)?.quantidade;
  if (typeof q !== 'number' || !Number.isInteger(q) || q < 1 || q > 999) throw invalido('Quantidade: informe um número de 1 a 999.');
  return q;
}

export function validarSituacaoDoPedido(corpo: unknown): 'pedido' | 'confirmado' | 'cancelado' {
  const s = (corpo as { situacao?: unknown } | null)?.situacao;
  if (s !== 'pedido' && s !== 'confirmado' && s !== 'cancelado') throw invalido('Situação: escolha uma das opções.');
  return s;
}

export function validarAnalise(corpo: unknown): { aprovar: boolean; observacao: string | null } {
  const x = (corpo ?? {}) as Record<string, unknown>;
  if (typeof x['aprovar'] !== 'boolean') throw invalido('Decisão: informe se a montagem foi aprovada.');
  const observacao = typeof x['observacao'] === 'string' ? x['observacao'].trim() : '';
  if (observacao.length > 500) throw invalido('Observação: use até 500 letras.');
  // Recusar sem dizer o que corrigir deixa o expositor sem saída.
  if (!x['aprovar'] && observacao.length < 3) throw invalido('Observação: diga o que precisa ser corrigido.');
  return { aprovar: x['aprovar'], observacao: observacao || null };
}

const CAMPOS_CONTRATO: Campos = {
  parceiroEventoId: { tipo: 'uuid', rotulo: 'Parceiro' },
  palestranteId: { tipo: 'uuid', rotulo: 'Palestrante' },
  modeloContratoId: { tipo: 'uuid', rotulo: 'Modelo' },
  corpo: { tipo: 'texto', rotulo: 'Texto do contrato', min: 20, max: 50_000 },
  valorCentavos: { tipo: 'inteiro', rotulo: 'Valor', min: 0, max: 2_000_000_000 },
  via: { tipo: 'opcao', rotulo: 'Forma de assinatura', opcoes: ['aceite_no_app', 'provedor', 'govbr_manual'] },
};

export interface NovoContrato {
  readonly parceiroEventoId: string | null; readonly palestranteId: string | null; readonly modeloContratoId: string | null;
  readonly corpo: string | null; readonly valorCentavos: number; readonly via: string;
}

export function validarNovoContrato(corpo: unknown): NovoContrato {
  const v = validarCampos(CAMPOS_CONTRATO, corpo, 'criar');
  if (Boolean(v['parceiroEventoId']) === Boolean(v['palestranteId'])) throw invalido('Contratado: escolha um parceiro ou um palestrante.');
  if (Boolean(v['modeloContratoId']) === Boolean(v['corpo'])) throw invalido('Texto do contrato: escolha um modelo ou escreva o texto.');
  return {
    parceiroEventoId: (v['parceiroEventoId'] as string | undefined) ?? null, palestranteId: (v['palestranteId'] as string | undefined) ?? null,
    modeloContratoId: (v['modeloContratoId'] as string | undefined) ?? null, corpo: (v['corpo'] as string | undefined) ?? null,
    valorCentavos: (v['valorCentavos'] as number | undefined) ?? 0, via: (v['via'] as string | undefined) ?? 'aceite_no_app',
  };
}

const CAMPOS_ALTERAR_CONTRATO: Campos = {
  corpo: { tipo: 'texto', rotulo: 'Texto do contrato', min: 20, max: 50_000, obrigatorio: true },
  valorCentavos: { tipo: 'inteiro', rotulo: 'Valor', min: 0, max: 2_000_000_000, obrigatorio: true },
  via: { tipo: 'opcao', rotulo: 'Forma de assinatura', opcoes: ['aceite_no_app', 'provedor', 'govbr_manual'], obrigatorio: true },
};
export const validarAlteracaoDeContrato = (corpo: unknown): Valores => validarCampos(CAMPOS_ALTERAR_CONTRATO, corpo, 'alterar');

/** Protocolo da assinatura feita fora do app (gov.br ou provedor). */
export function validarReferencia(corpo: unknown): string {
  const r = (corpo as { referencia?: unknown } | null)?.referencia;
  const texto = typeof r === 'string' ? r.trim() : '';
  if (texto.length < 3 || texto.length > 200) throw invalido('Protocolo: informe o protocolo ou identificador da assinatura.');
  return texto;
}

/** Quanto falta para o próximo nível, para a tela dizer "faltam R$ X para Ouro". */
export function proximoNivel(
  investimentoCentavos: number,
  niveis: readonly { readonly nome: string; readonly investimentoMinimoCentavos: number }[],
): { nome: string; faltamCentavos: number } | null {
  const acima = niveis.filter((n) => n.investimentoMinimoCentavos > investimentoCentavos)
    .sort((a, b) => a.investimentoMinimoCentavos - b.investimentoMinimoCentavos)[0];
  return acima ? { nome: acima.nome, faltamCentavos: acima.investimentoMinimoCentavos - investimentoCentavos } : null;
}
