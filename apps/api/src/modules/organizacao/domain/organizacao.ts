/** Regras puras de organização, evento, equipe e convite (feature 07, ADR 0025). Sem I/O. */
import { ErroDominio } from '../../../shared/dominio/erro.ts';
import { normalizarEmail } from '../../conta/domain/regras.ts';
import { validarCampos } from '../../cadastros/domain/campos.ts';
import type { Campos, Valores } from '../../cadastros/domain/campos.ts';

export const PAPEIS_EVENTO = ['admin', 'conteudo', 'credenciamento', 'financeiro', 'comercial', 'comunicacao', 'operacao', 'acessibilidade'] as const;
export const PAPEIS_ORGANIZACAO = ['dono', 'admin'] as const;
export type PapelEvento = (typeof PAPEIS_EVENTO)[number];

/**
 * Aparência (ADR 0011): cinco chaves, com cores de uma paleta fechada. Cada cor
 * da paleta já foi conferida contra os três temas, então nenhuma escolha do
 * organizador consegue quebrar contraste.
 */
export const PALETA = ['azul', 'verde', 'vinho', 'laranja', 'roxo', 'grafite', 'petroleo', 'terracota'] as const;
export const FONTES = ['padrao', 'serifada', 'legivel'] as const;
export const ARREDONDAMENTOS = ['reto', 'suave', 'redondo'] as const;

const CAMPOS_TEMA: Campos = {
  corPrimaria: { tipo: 'opcao', rotulo: 'Cor principal', opcoes: PALETA, obrigatorio: true },
  corDestaque: { tipo: 'opcao', rotulo: 'Cor de destaque', opcoes: PALETA, obrigatorio: true },
  fonte: { tipo: 'opcao', rotulo: 'Fonte', opcoes: FONTES, obrigatorio: true },
  arredondamento: { tipo: 'opcao', rotulo: 'Cantos', opcoes: ARREDONDAMENTOS, obrigatorio: true },
  logoUrl: { tipo: 'url', rotulo: 'Logo' },
  logoDescricao: { tipo: 'texto', rotulo: 'Descrição do logo', min: 3, max: 160 },
};

export interface Tema {
  readonly corPrimaria: string;
  readonly corDestaque: string;
  readonly fonte: string;
  readonly arredondamento: string;
  readonly logoUrl?: string;
  readonly logoDescricao?: string;
}

export function validarTema(corpo: unknown): Tema {
  const v = validarCampos(CAMPOS_TEMA, corpo, 'criar');
  if (v['corPrimaria'] === v['corDestaque']) throw new ErroDominio('dados_invalidos', 'Cor de destaque: escolha uma cor diferente da principal.');
  // Logo sem descrição ficaria mudo no leitor de tela.
  if (v['logoUrl'] && !v['logoDescricao']) throw new ErroDominio('dados_invalidos', 'Descrição do logo: descreva a imagem para quem usa leitor de tela.');
  return Object.fromEntries(Object.entries(v).filter(([, valor]) => valor !== null)) as unknown as Tema;
}

const CAMPOS_ORGANIZACAO: Campos = {
  nome: { tipo: 'texto', rotulo: 'Nome da organização', min: 2, max: 120, obrigatorio: true },
  cnpj: { tipo: 'cnpj', rotulo: 'CNPJ' },
};

const CAMPOS_EVENTO: Campos = {
  nome: { tipo: 'texto', rotulo: 'Nome do evento', min: 3, max: 120, obrigatorio: true },
  slug: { tipo: 'texto', rotulo: 'Endereço do evento', min: 3, max: 60, padrao: /^[a-z0-9]+(-[a-z0-9]+)*$/, obrigatorio: true },
  inicio: { tipo: 'data', rotulo: 'Primeiro dia', obrigatorio: true },
  fim: { tipo: 'data', rotulo: 'Último dia', obrigatorio: true },
  local: { tipo: 'texto', rotulo: 'Cidade ou local', max: 200, obrigatorio: true },
  demonstracao: { tipo: 'booleano', rotulo: 'Evento de demonstração' },
};

const CAMPOS_ALTERAR_EVENTO: Campos = {
  nome: { tipo: 'texto', rotulo: 'Nome do evento', min: 3, max: 120, obrigatorio: true },
  inicio: { tipo: 'data', rotulo: 'Primeiro dia', obrigatorio: true },
  fim: { tipo: 'data', rotulo: 'Último dia', obrigatorio: true },
  local: { tipo: 'texto', rotulo: 'Cidade ou local', max: 200, obrigatorio: true },
  localId: { tipo: 'uuid', rotulo: 'Local' },
  descricao: { tipo: 'texto', rotulo: 'Descrição', max: 2000 },
  inscricoesAbertas: { tipo: 'booleano', rotulo: 'Inscrições abertas', obrigatorio: true },
  recursosOferecidos: { tipo: 'opcoes', rotulo: 'Recursos de acessibilidade', opcoes: ['libras', 'legenda', 'audiodescricao', 'acesso_sem_degraus'], obrigatorio: true },
  publicado: { tipo: 'booleano', rotulo: 'Publicado', obrigatorio: true },
  feiraM2PorCredencial: { tipo: 'inteiro', rotulo: 'Metros quadrados por credencial', min: 1, max: 100, obrigatorio: true },
};

const ordemDasDatas = (inicio: unknown, fim: unknown): void => {
  if (typeof inicio === 'string' && typeof fim === 'string' && fim < inicio) {
    throw new ErroDominio('dados_invalidos', 'Último dia: precisa ser igual ou depois do primeiro dia.');
  }
};

export const validarOrganizacao = (corpo: unknown): Valores => validarCampos(CAMPOS_ORGANIZACAO, corpo, 'criar');

export function validarNovoEvento(corpo: unknown): Valores {
  const v = validarCampos(CAMPOS_EVENTO, corpo, 'criar');
  ordemDasDatas(v['inicio'], v['fim']);
  return v;
}

/** Alteração parcial do evento; o tema, quando vem, é validado inteiro. */
export function validarAlteracaoDeEvento(corpo: unknown): { valores: Valores; tema?: Tema } {
  const { tema, ...resto } = (corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo : {}) as Record<string, unknown>;
  const temTema = tema !== undefined;
  const valores = temTema && Object.keys(resto).length === 0 ? {} : validarCampos(CAMPOS_ALTERAR_EVENTO, temTema ? resto : corpo, 'alterar');
  ordemDasDatas(valores['inicio'], valores['fim']);
  return temTema ? { valores, tema: validarTema(tema) } : { valores };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@.]{2,}$/;

export function validarEmailDeConvite(email: unknown): string {
  const normal = typeof email === 'string' ? normalizarEmail(email) : '';
  if (!EMAIL.test(normal)) throw new ErroDominio('dados_invalidos', 'E-mail: confira o endereço, como nome@exemplo.com.br.');
  return normal;
}

export function validarPapeis(papeis: unknown, permitidos: readonly string[]): string[] {
  if (!Array.isArray(papeis) || papeis.length === 0 || papeis.some((p) => typeof p !== 'string' || !permitidos.includes(p))) {
    throw new ErroDominio('dados_invalidos', 'Papéis: escolha pelo menos um papel da lista.');
  }
  return [...new Set(papeis as string[])];
}

export interface DadosConvite {
  readonly email: string;
  readonly papeis: string[];
}

export function validarConvite(corpo: unknown, permitidos: readonly string[]): DadosConvite {
  const c = (corpo ?? {}) as Record<string, unknown>;
  return { email: validarEmailDeConvite(c['email']), papeis: validarPapeis(c['papeis'], permitidos) };
}

export interface DadosMembro {
  readonly papeis: string[];
  readonly cargo: string | null;
  readonly exibirPublico: boolean;
}

export function validarMembro(corpo: unknown): DadosMembro {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const cargo = typeof c['cargo'] === 'string' ? c['cargo'].trim() : '';
  if (cargo.length === 1 || cargo.length > 80) throw new ErroDominio('dados_invalidos', 'Cargo: use de 2 a 80 letras.');
  const exibirPublico = c['exibirPublico'] === true;
  // Aparecer na página do evento sem cargo não diz nada a quem lê.
  if (exibirPublico && !cargo) throw new ErroDominio('dados_invalidos', 'Cargo: informe o cargo de quem aparece na página do evento.');
  return { papeis: validarPapeis(c['papeis'], PAPEIS_EVENTO), cargo: cargo || null, exibirPublico };
}

/** O que cada papel permite, numa frase: é o texto que a tela de convite lê em voz alta. */
export const DESCRICAO_DOS_PAPEIS: Readonly<Record<PapelEvento, string>> = {
  admin: 'Pode tudo neste evento, inclusive montar a equipe.',
  conteudo: 'Cuida da programação, das salas e dos palestrantes.',
  credenciamento: 'Lê os QR na entrada e confere meia-entrada.',
  financeiro: 'Vê pedidos, cuida dos ingressos e dos contratos.',
  comercial: 'Cuida da feira, dos expositores e dos contratos.',
  comunicacao: 'Publica avisos para os participantes.',
  operacao: 'Monta zonas, pontos de leitura e credenciais.',
  acessibilidade: 'Acompanha os pedidos e os recursos de acessibilidade.',
};

export const NOMES_DOS_PAPEIS: Readonly<Record<string, string>> = {
  dono: 'Dono', admin: 'Administração', conteudo: 'Conteúdo', credenciamento: 'Credenciamento', financeiro: 'Financeiro',
  comercial: 'Comercial', comunicacao: 'Comunicação', operacao: 'Operação', acessibilidade: 'Acessibilidade',
  responsavel: 'Responsável', equipe: 'Equipe',
};

export function textoDoConvite(c: { organizacao: string; evento: string | null; parceiro?: string | null; papeis: readonly string[] }): { assunto: string; texto: string } {
  const onde = c.parceiro ? `${c.parceiro} no evento ${c.evento ?? ''}`.trim() : (c.evento ?? c.organizacao);
  return {
    assunto: `Convite para a equipe: ${onde}`,
    texto: [
      `Você foi convidado para a equipe de ${onde}.`,
      `Papéis: ${c.papeis.map((p) => NOMES_DOS_PAPEIS[p] ?? p).join(', ')}.`,
      '',
      'Para aceitar, entre no Acessa Evento com este mesmo e-mail. O convite aparece assim que você entrar e vale por 14 dias.',
      'Se você não esperava este convite, ignore este e-mail. Nada acontece sem o seu aceite.',
    ].join('\n'),
  };
}
