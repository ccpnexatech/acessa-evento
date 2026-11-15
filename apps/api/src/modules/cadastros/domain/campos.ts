/**
 * Validação declarativa dos cadastros do organizador (ADR 0029). Cada cadastro
 * descreve seus campos uma vez; daqui saem a validação, a mensagem para a
 * pessoa e, no adaptador, a coluna. Puro, sem I/O.
 */
import { ErroDominio, UUID } from '../../../shared/dominio/erro.ts';

interface Base {
  /** Nome do campo como a pessoa lê na tela; abre a mensagem de erro. */
  readonly rotulo: string;
  /** Obrigatório ao criar. Campo obrigatório nunca aceita nulo. */
  readonly obrigatorio?: boolean;
}

export type Campo = Base & (
  | { readonly tipo: 'texto'; readonly min?: number; readonly max: number; readonly padrao?: RegExp; readonly maiusculas?: boolean }
  | { readonly tipo: 'inteiro' | 'numero'; readonly min?: number; readonly max?: number }
  | { readonly tipo: 'booleano' | 'uuid' | 'instante' | 'data' | 'url' | 'cnpj' }
  | { readonly tipo: 'opcao'; readonly opcoes: readonly string[] }
  | { readonly tipo: 'opcoes'; readonly opcoes: readonly string[] }
  | { readonly tipo: 'textos'; readonly max: number; readonly maxItens: number }
);

export type Campos = Readonly<Record<string, Campo>>;
export type Valor = string | number | boolean | null | readonly string[];
export type Valores = Readonly<Record<string, Valor>>;

const invalido = (campo: Campo, motivo: string) => new ErroDominio('dados_invalidos', `${campo.rotulo}: ${motivo}`);

/** CNPJ com os dois dígitos verificadores conferidos. Devolve só os números. */
export function cnpjValido(texto: string): string | null {
  const d = texto.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return null;
  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * ((ate - i - 1) % 8 + 2);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]) ? d : null;
}

function validar(campo: Campo, bruto: unknown): Valor {
  switch (campo.tipo) {
    case 'texto': {
      if (typeof bruto !== 'string') throw invalido(campo, 'escreva um texto.');
      const texto = campo.maiusculas ? bruto.trim().toUpperCase() : bruto.trim();
      const min = campo.min ?? 1;
      if (texto.length < min) throw invalido(campo, min > 1 ? `use pelo menos ${min} letras.` : 'preencha este campo.');
      if (texto.length > campo.max) throw invalido(campo, `use até ${campo.max} letras.`);
      if (campo.padrao && !campo.padrao.test(texto)) throw invalido(campo, 'formato inválido.');
      return texto;
    }
    case 'inteiro':
    case 'numero': {
      if (typeof bruto !== 'number' || !Number.isFinite(bruto) || (campo.tipo === 'inteiro' && !Number.isInteger(bruto))) {
        throw invalido(campo, campo.tipo === 'inteiro' ? 'informe um número inteiro.' : 'informe um número.');
      }
      if (campo.min !== undefined && bruto < campo.min) throw invalido(campo, `o mínimo é ${campo.min}.`);
      if (campo.max !== undefined && bruto > campo.max) throw invalido(campo, `o máximo é ${campo.max}.`);
      return bruto;
    }
    case 'booleano':
      if (typeof bruto !== 'boolean') throw invalido(campo, 'responda sim ou não.');
      return bruto;
    case 'uuid':
      if (typeof bruto !== 'string' || !UUID.test(bruto)) throw invalido(campo, 'escolha um item da lista.');
      return bruto.toLowerCase();
    case 'instante': {
      const ms = typeof bruto === 'string' ? Date.parse(bruto) : Number.NaN;
      if (Number.isNaN(ms)) throw invalido(campo, 'informe data e hora.');
      return new Date(ms).toISOString();
    }
    case 'data': {
      const ok = typeof bruto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bruto)
        && new Date(`${bruto}T00:00:00Z`).toISOString().startsWith(bruto);
      if (!ok) throw invalido(campo, 'informe uma data.');
      return bruto as string;
    }
    case 'url': {
      const ok = typeof bruto === 'string' && bruto.length <= 300 && URL.canParse(bruto) && new URL(bruto).protocol === 'https:';
      if (!ok) throw invalido(campo, 'informe um endereço que comece com https://.');
      return bruto as string;
    }
    case 'cnpj': {
      const cnpj = typeof bruto === 'string' ? cnpjValido(bruto) : null;
      if (!cnpj) throw invalido(campo, 'confira os 14 números do CNPJ.');
      return cnpj;
    }
    case 'opcao':
      if (typeof bruto !== 'string' || !campo.opcoes.includes(bruto)) throw invalido(campo, 'escolha uma das opções.');
      return bruto;
    case 'opcoes': {
      if (!Array.isArray(bruto) || bruto.some((x) => typeof x !== 'string' || !campo.opcoes.includes(x))) {
        throw invalido(campo, 'escolha entre as opções da lista.');
      }
      return [...new Set(bruto as string[])];
    }
    case 'textos': {
      if (!Array.isArray(bruto) || bruto.length > campo.maxItens) throw invalido(campo, `liste até ${campo.maxItens} itens.`);
      return bruto.map((x: unknown) => {
        const texto = typeof x === 'string' ? x.trim() : '';
        if (texto.length < 1 || texto.length > campo.max) throw invalido(campo, `cada item precisa ter até ${campo.max} letras.`);
        return texto;
      });
    }
  }
}

/**
 * Confere o corpo contra os campos. Ao criar, exige os obrigatórios; ao
 * alterar, aceita qualquer subconjunto não vazio. Campo desconhecido é erro:
 * silêncio aqui esconderia um erro de digitação da tela.
 */
export function validarCampos(campos: Campos, corpo: unknown, modo: 'criar' | 'alterar'): Valores {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDominio('dados_invalidos', 'Envie os dados em JSON.');
  }
  const entrada = corpo as Record<string, unknown>;
  for (const chave of Object.keys(entrada)) {
    if (!Object.hasOwn(campos, chave)) throw new ErroDominio('dados_invalidos', `Campo desconhecido: ${chave}.`);
  }
  const saida: Record<string, Valor> = {};
  for (const [nome, campo] of Object.entries(campos)) {
    const bruto = entrada[nome];
    if (bruto === undefined) {
      if (modo === 'criar' && campo.obrigatorio) throw invalido(campo, 'preencha este campo.');
      continue;
    }
    // Texto vazio em campo opcional é o jeito de a tela dizer "sem valor".
    const vazio = bruto === null || (campo.tipo === 'texto' && typeof bruto === 'string' && bruto.trim() === '');
    if (vazio) {
      if (campo.obrigatorio) throw invalido(campo, 'preencha este campo.');
      saida[nome] = null;
      continue;
    }
    saida[nome] = validar(campo, bruto);
  }
  if (modo === 'alterar' && Object.keys(saida).length === 0) throw new ErroDominio('dados_invalidos', 'Nada para alterar.');
  return saida;
}
