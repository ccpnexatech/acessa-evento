/**
 * Catálogo dos cadastros simples do organizador: o que cada um aceita.
 * Operações com regra própria (reservar estande, assinar contrato, emitir
 * credencial, convidar) não estão aqui: têm caso de uso próprio.
 */
import type { Campos } from './campos.ts';

export const CATEGORIAS = [
  'congressista', 'palestrante', 'convidado', 'expositor', 'equipe',
  'alimentacao', 'entretenimento', 'limpeza', 'seguranca', 'montagem', 'marketing',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Categorias que um parceiro (pessoa jurídica) pode ter num evento. */
export const CATEGORIAS_PARCEIRO = CATEGORIAS.filter((c) => !['congressista', 'palestrante', 'convidado', 'equipe'].includes(c));

export interface Cadastro {
  /** A quem o cadastro pertence: é o que a URL e a permissão do banco usam. */
  readonly escopo: 'evento' | 'organizacao';
  readonly campos: Campos;
  /** Operações oferecidas; o padrão é todas. */
  readonly sem?: readonly ('alterar' | 'apagar')[];
}

const nome = (max: number, min = 2) => ({ tipo: 'texto', rotulo: 'Nome', min, max, obrigatorio: true }) as const;
const preco = { tipo: 'inteiro', rotulo: 'Preço', min: 0, max: 100_000_000, obrigatorio: true } as const;

export const CADASTROS = {
  locais: {
    escopo: 'organizacao',
    campos: {
      nome: nome(120),
      endereco: { tipo: 'texto', rotulo: 'Endereço', max: 200 },
      cidade: { tipo: 'texto', rotulo: 'Cidade', max: 80 },
      uf: { tipo: 'texto', rotulo: 'UF', max: 2, padrao: /^[A-Z]{2}$/, maiusculas: true },
      acessibilidade: { tipo: 'texto', rotulo: 'Acessibilidade do local', max: 2000 },
    },
  },
  parceiros: {
    escopo: 'organizacao',
    campos: {
      razaoSocial: { tipo: 'texto', rotulo: 'Razão social', min: 2, max: 160, obrigatorio: true },
      nomeFantasia: { tipo: 'texto', rotulo: 'Nome fantasia', min: 2, max: 120 },
      cnpj: { tipo: 'cnpj', rotulo: 'CNPJ' },
    },
  },
  'modelos-contrato': {
    escopo: 'organizacao',
    campos: {
      nome: nome(80),
      corpo: { tipo: 'texto', rotulo: 'Texto do contrato', min: 20, max: 50_000, obrigatorio: true },
    },
  },
  zonas: {
    escopo: 'evento',
    campos: {
      nome: nome(80, 1),
      descricao: { tipo: 'texto', rotulo: 'Descrição', max: 500 },
      aberta: { tipo: 'booleano', rotulo: 'Zona aberta' },
      rotaAcessivel: { tipo: 'texto', rotulo: 'Rota acessível', max: 1000 },
      ordem: { tipo: 'inteiro', rotulo: 'Ordem', min: 0, max: 999 },
    },
  },
  salas: {
    escopo: 'evento',
    campos: {
      nome: nome(80, 1),
      local: { tipo: 'texto', rotulo: 'Onde fica', max: 120, obrigatorio: true },
      acessibilidade: { tipo: 'texto', rotulo: 'Acessibilidade da sala', max: 1000 },
      zonaId: { tipo: 'uuid', rotulo: 'Zona' },
      capacidade: { tipo: 'inteiro', rotulo: 'Capacidade', min: 1, max: 100_000 },
      lugaresReservados: { tipo: 'inteiro', rotulo: 'Lugares reservados', min: 0, max: 100_000 },
    },
  },
  palestrantes: {
    escopo: 'evento',
    campos: {
      nome: nome(120),
      cargo: { tipo: 'texto', rotulo: 'Cargo', max: 160 },
    },
  },
  atividades: {
    escopo: 'evento',
    campos: {
      titulo: { tipo: 'texto', rotulo: 'Título', min: 3, max: 200, obrigatorio: true },
      resumo: { tipo: 'texto', rotulo: 'Resumo', max: 2000 },
      inicio: { tipo: 'instante', rotulo: 'Início', obrigatorio: true },
      fim: { tipo: 'instante', rotulo: 'Fim', obrigatorio: true },
      salaId: { tipo: 'uuid', rotulo: 'Sala' },
      zonaId: { tipo: 'uuid', rotulo: 'Zona' },
      tipo: { tipo: 'opcao', rotulo: 'Tipo', opcoes: ['sessao', 'festa', 'paralela'] },
      recursos: { tipo: 'opcoes', rotulo: 'Recursos de acessibilidade', opcoes: ['libras', 'legenda', 'audiodescricao'] },
      publicada: { tipo: 'booleano', rotulo: 'Publicada' },
    },
  },
  'pontos-leitura': {
    escopo: 'evento',
    campos: {
      nome: nome(40, 1),
      zonaId: { tipo: 'uuid', rotulo: 'Zona' },
      tipo: { tipo: 'opcao', rotulo: 'Tipo', opcoes: ['celular', 'catraca', 'totem'] },
      modo: { tipo: 'opcao', rotulo: 'Modo', opcoes: ['entrada_unica', 'passagem_livre'] },
      ativo: { tipo: 'booleano', rotulo: 'Ativo' },
    },
  },
  'tipos-ingresso': {
    escopo: 'evento',
    campos: {
      nome: nome(60),
      descricao: { tipo: 'texto', rotulo: 'Descrição', max: 200 },
      precoCentavos: preco,
      vagas: { tipo: 'inteiro', rotulo: 'Vagas', min: 0, max: 1_000_000, obrigatorio: true },
      ordem: { tipo: 'inteiro', rotulo: 'Ordem', min: 1, max: 99 },
      modalidade: { tipo: 'opcao', rotulo: 'Modalidade', opcoes: ['inteira', 'meia', 'acompanhante', 'cortesia'] },
      publicoVeSaldo: { tipo: 'booleano', rotulo: 'Mostrar vagas restantes' },
    },
  },
  avisos: {
    escopo: 'evento',
    campos: {
      titulo: { tipo: 'texto', rotulo: 'Título', min: 3, max: 80, obrigatorio: true },
      corpo: { tipo: 'texto', rotulo: 'Mensagem', min: 3, max: 1000, obrigatorio: true },
      categorias: { tipo: 'opcoes', rotulo: 'Para quem', opcoes: CATEGORIAS },
      urgente: { tipo: 'booleano', rotulo: 'Urgente' },
      publicarEm: { tipo: 'instante', rotulo: 'Publicar em' },
    },
  },
  segmentos: { escopo: 'evento', campos: { nome: nome(60) } },
  plantas: {
    escopo: 'evento',
    campos: {
      nome: nome(80),
      zonaId: { tipo: 'uuid', rotulo: 'Zona' },
      colunas: { tipo: 'inteiro', rotulo: 'Colunas', min: 1, max: 60, obrigatorio: true },
      linhas: { tipo: 'inteiro', rotulo: 'Linhas', min: 1, max: 60, obrigatorio: true },
      imagemUrl: { tipo: 'url', rotulo: 'Imagem de fundo' },
    },
  },
  'tipos-estande': {
    escopo: 'evento',
    campos: {
      nome: nome(60),
      larguraM: { tipo: 'numero', rotulo: 'Largura em metros', min: 0.5, max: 99, obrigatorio: true },
      profundidadeM: { tipo: 'numero', rotulo: 'Profundidade em metros', min: 0.5, max: 99, obrigatorio: true },
      precoCentavos: preco,
    },
  },
  estandes: {
    escopo: 'evento',
    campos: {
      plantaId: { tipo: 'uuid', rotulo: 'Planta', obrigatorio: true },
      tipoEstandeId: { tipo: 'uuid', rotulo: 'Tipo de estande', obrigatorio: true },
      codigo: { tipo: 'texto', rotulo: 'Código', max: 8, padrao: /^[A-Z0-9-]{1,8}$/, maiusculas: true, obrigatorio: true },
      coluna: { tipo: 'inteiro', rotulo: 'Coluna', min: 1, max: 60, obrigatorio: true },
      linha: { tipo: 'inteiro', rotulo: 'Linha', min: 1, max: 60, obrigatorio: true },
    },
  },
  'niveis-expositor': {
    escopo: 'evento',
    campos: {
      nome: nome(40),
      investimentoMinimoCentavos: { tipo: 'inteiro', rotulo: 'Investimento mínimo', min: 0, max: 2_000_000_000, obrigatorio: true },
      beneficios: { tipo: 'textos', rotulo: 'Benefícios', max: 80, maxItens: 8 },
    },
  },
  'servicos-feira': {
    escopo: 'evento',
    campos: {
      nome: nome(80),
      descricao: { tipo: 'texto', rotulo: 'Descrição', max: 500 },
      unidade: { tipo: 'texto', rotulo: 'Unidade', max: 20 },
      precoCentavos: preco,
      obrigatorio: { tipo: 'booleano', rotulo: 'Obrigatório' },
      prazo: { tipo: 'data', rotulo: 'Prazo' },
      ativo: { tipo: 'booleano', rotulo: 'Ativo' },
    },
  },
  'parceiros-evento': {
    escopo: 'evento',
    sem: ['alterar'],
    campos: {
      parceiroId: { tipo: 'uuid', rotulo: 'Parceiro', obrigatorio: true },
      categoria: { tipo: 'opcao', rotulo: 'Categoria', opcoes: CATEGORIAS_PARCEIRO },
    },
  },
} as const satisfies Record<string, Cadastro>;

export type NomeCadastro = keyof typeof CADASTROS;
export const NOMES_CADASTRO = Object.keys(CADASTROS) as NomeCadastro[];
export const cadastro = (nomeCadastro: NomeCadastro): Cadastro => CADASTROS[nomeCadastro];
