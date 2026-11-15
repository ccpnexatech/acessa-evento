/**
 * Adaptador Postgres dos cadastros simples. Um único conjunto de instruções,
 * montado a partir do catálogo: nomes de tabela e coluna vêm só de constantes
 * deste arquivo e do catálogo, nunca da requisição. Quem pode o quê é
 * decidido pela RLS; aqui o erro do banco vira ErroDominio.
 */
import type { Banco } from '../../../../shared/db/banco.ts';
import { comErroDeBanco } from '../../../../shared/db/erro-banco.ts';
import type { Registro, RepositorioCadastros } from '../../application/cadastros.ts';
import type { Campo } from '../../domain/campos.ts';
import { CADASTROS } from '../../domain/catalogo.ts';
import type { NomeCadastro } from '../../domain/catalogo.ts';

interface Tabela {
  readonly tabela: string;
  readonly ordem: string;
  /** Colunas só de leitura devolvidas junto (nome na API → expressão SQL). */
  readonly extras?: Readonly<Record<string, string>>;
  /** Coluna preenchida com quem está criando. */
  readonly autor?: string;
}

const TABELAS: Readonly<Record<NomeCadastro, Tabela>> = {
  locais: { tabela: 'local', ordem: 'nome' },
  parceiros: { tabela: 'parceiro', ordem: 'razao_social' },
  'modelos-contrato': { tabela: 'modelo_contrato', ordem: 'nome' },
  zonas: { tabela: 'zona', ordem: 'ordem, nome' },
  salas: { tabela: 'sala', ordem: 'nome' },
  palestrantes: { tabela: 'palestrante', ordem: 'nome' },
  atividades: { tabela: 'atividade', ordem: 'inicio, titulo' },
  'pontos-leitura': { tabela: 'ponto_leitura', ordem: 'nome', extras: { ultimaSincEm: 'ultima_sinc_em' } },
  'tipos-ingresso': { tabela: 'tipo_ingresso', ordem: 'ordem, nome', extras: { ocupadas: 'ocupadas' } },
  avisos: { tabela: 'aviso', ordem: 'publicar_em desc', autor: 'criado_por', extras: { criadoEm: 'criado_em' } },
  segmentos: { tabela: 'segmento', ordem: 'nome' },
  plantas: { tabela: 'planta', ordem: 'nome' },
  'tipos-estande': { tabela: 'tipo_estande', ordem: 'preco_centavos, nome' },
  estandes: {
    tabela: 'estande', ordem: 'codigo',
    extras: { situacao: 'situacao', reservadoAte: 'reservado_ate', parceiroEventoId: 'parceiro_evento_id', valorCentavos: 'valor_centavos' },
  },
  'niveis-expositor': { tabela: 'nivel_expositor', ordem: 'investimento_minimo_centavos' },
  'servicos-feira': { tabela: 'servico_feira', ordem: 'nome' },
  'parceiros-evento': { tabela: 'parceiro_evento', ordem: 'criado_em', extras: { situacao: 'situacao' } },
};

const MENSAGENS = {
  zona_evento_id_nome_key: 'Já existe uma zona com esse nome neste evento.',
  sala_evento_id_nome_key: 'Já existe uma sala com esse nome neste evento.',
  ponto_leitura_evento_id_nome_key: 'Já existe um ponto de leitura com esse nome.',
  tipo_ingresso_evento_id_nome_key: 'Já existe um tipo de ingresso com esse nome.',
  estande_planta_id_codigo_key: 'Já existe um estande com esse código nesta planta.',
  estande_planta_id_coluna_linha_key: 'Já existe um estande nessa posição da planta.',
  nivel_expositor_evento_id_investimento_minimo_centavos_key: 'Já existe um nível com esse investimento mínimo.',
  parceiro_organizacao_id_cnpj_key: 'Já existe um parceiro com esse CNPJ.',
  parceiro_evento_parceiro_id_evento_id_categoria_key: 'Este parceiro já está neste evento com essa categoria.',
  atividade_check: 'O fim da atividade precisa ser depois do início.',
  tipo_ingresso_ocupadas_check: 'As vagas não podem ficar abaixo do que já foi vendido.',
} as const;

const coluna = (campo: string): string => campo.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);

/** Como a coluna volta para a API: datas e decimais em formato estável. */
function leitura(nomeCampo: string, campo: Campo): string {
  const c = coluna(nomeCampo);
  if (campo.tipo === 'data') return `to_char(${c}, 'YYYY-MM-DD') as "${nomeCampo}"`;
  if (campo.tipo === 'numero') return `${c}::float8 as "${nomeCampo}"`;
  if (campo.tipo === 'opcoes') return `${c}::text[] as "${nomeCampo}"`;
  return `${c} as "${nomeCampo}"`;
}

function colunasDeLeitura(nome: NomeCadastro): string {
  const t = TABELAS[nome];
  return [
    'id',
    ...Object.entries(CADASTROS[nome].campos).map(([n, c]) => leitura(n, c as Campo)),
    ...Object.entries(t.extras ?? {}).map(([api, sql]) => `${sql} as "${api}"`),
  ].join(', ');
}

const colunaDoEscopo = (nome: NomeCadastro): string => (CADASTROS[nome].escopo === 'evento' ? 'evento_id' : 'organizacao_id');

export function repositorioCadastros(banco: Banco): RepositorioCadastros {
  return {
    async escopo(pessoaId, tipo, referencia) {
      const sql = tipo === 'evento' ? 'select id from evento where slug = $1' : 'select id from organizacao where id = $1';
      const [linha] = await banco.transacao({ pessoaId }, (tx) => tx.consultar<{ id: string }>(sql, [referencia]));
      return linha?.id ?? null;
    },
    listar(pessoaId, nome, escopoId) {
      const t = TABELAS[nome];
      return banco.transacao({ pessoaId }, (tx) => tx.consultar<Registro>(
        `select ${colunasDeLeitura(nome)} from ${t.tabela} where ${colunaDoEscopo(nome)} = $1 order by ${t.ordem}`, [escopoId]));
    },
    criar(pessoaId, nome, escopoId, valores) {
      const t = TABELAS[nome];
      const campos = Object.keys(valores);
      const colunas = [colunaDoEscopo(nome), ...(t.autor ? [t.autor] : []), ...campos.map(coluna)];
      const parametros = [escopoId, ...(t.autor ? [pessoaId] : []), ...campos.map((c) => valores[c])];
      return comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
        const [linha] = await tx.consultar<Registro>(
          `insert into ${t.tabela} (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${i + 1}`).join(', ')})
           returning ${colunasDeLeitura(nome)}`, parametros);
        if (!linha) throw new Error('insert sem linha devolvida');
        return linha;
      }), MENSAGENS);
    },
    alterar(pessoaId, nome, escopoId, id, valores) {
      const t = TABELAS[nome];
      const campos = Object.keys(valores);
      return comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
        const [linha] = await tx.consultar<Registro>(
          `update ${t.tabela} set ${campos.map((c, i) => `${coluna(c)} = $${i + 3}`).join(', ')}
           where id = $1 and ${colunaDoEscopo(nome)} = $2 returning ${colunasDeLeitura(nome)}`,
          [id, escopoId, ...campos.map((c) => valores[c])]);
        return linha ?? null;
      }), MENSAGENS);
    },
    apagar(pessoaId, nome, escopoId, id) {
      const t = TABELAS[nome];
      return comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
        const linhas = await tx.consultar(`delete from ${t.tabela} where id = $1 and ${colunaDoEscopo(nome)} = $2 returning id`, [id, escopoId]);
        return linhas.length > 0;
      }), MENSAGENS);
    },
  };
}
