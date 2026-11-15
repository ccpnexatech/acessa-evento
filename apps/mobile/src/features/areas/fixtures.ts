/** Dados de exemplo e API de mentira para os testes das áreas. */
import type { ApiAreas, Hoje, Inicio, MinhaCredencial, Participacao, Portal } from './api';
import { CRED, qr } from '../acessos/fixtures';

export const INICIO: Inicio = {
  eventos: [
    { slug: 'jornada-2027', nome: 'Jornada 2027', inicio: '2027-03-01', fim: '2027-03-03', publicado: true, demonstracao: false, papeis: ['dono'] },
    { slug: 'ensaio', nome: 'Ensaio geral', inicio: '2027-02-01', fim: '2027-02-01', publicado: false, demonstracao: true, papeis: ['conteudo'] },
  ],
  convites: [{ id: 'c1', organizacao: 'Sociedade A', evento: 'COCAL 2026', parceiro: null, papeis: ['credenciamento', 'acessibilidade'], expiraEm: '2027-03-01T00:00:00Z' }],
};
export const PARTICIPACAO: Participacao = { id: 'pe1', parceiro: 'Xis Med', categoria: 'expositor', situacao: 'convidado', papel: 'responsavel', evento: { slug: 'jornada-2027', nome: 'Jornada 2027' } };
const EVENTO = { slug: 'jornada-2027', nome: 'Jornada 2027', inicio: '2027-03-01', fim: '2027-03-03', local: 'Fortaleza' };
export const CREDENCIAIS: MinhaCredencial[] = [
  { id: CRED.eva, categoria: 'palestrante', revogada: false, parceiro: null, qr: qr({ c: CRED.eva }), evento: EVENTO },
  { id: CRED.cancelada, categoria: 'expositor', revogada: true, parceiro: 'Xis Med', qr: null, evento: EVENTO },
];
export const HOJE: Hoje = {
  numeros: { inscritos: 40, credenciais: 52, entradas: 15, leiturasNegadas: 2 },
  pontos: [
    { id: 'p1', nome: 'Portão 1', zona: null, ativo: true, entradas: 12, saidas: 0, negadas: 2, ultimaLeituraEm: '2027-03-01T11:54:00Z', minutosSemSincronizar: 5, atencao: null },
    { id: 'p2', nome: 'Portão 2', zona: null, ativo: true, entradas: 3, saidas: 0, negadas: 0, ultimaLeituraEm: null, minutosSemSincronizar: 60, atencao: 'Sem atualizar há 60 min. Peça para abrir o leitor com internet.' },
    { id: 'p3', nome: 'Porta VIP', zona: 'Sala VIP', ativo: true, entradas: 1, saidas: 1, negadas: 0, ultimaLeituraEm: null, minutosSemSincronizar: 2, atencao: null },
    { id: 'p4', nome: 'Totem', zona: null, ativo: false, entradas: 0, saidas: 0, negadas: 0, ultimaLeituraEm: null, minutosSemSincronizar: null, atencao: null },
  ],
  geradoEm: '2027-03-01T12:00:00Z',
};
export const PORTAL: Portal = {
  participacao: PARTICIPACAO,
  resumo: { estandes: 0, areaM2: 0, investimentoCentavos: 0, nivel: null, credenciaisDireito: 0, proximoNivel: { nome: 'Prata', faltamCentavos: 1000000 } },
  estandes: [{ id: 'e1', codigo: 'A1', situacao: 'reservado', reservadoAte: '2027-02-12T15:00:00Z', valorCentavos: 600000, tipo: 'Linha 3x3' }],
  perfil: null,
  pedidos: [{ id: 's1', servico: 'Energia', unidade: 'kVA', quantidade: 4, valorCentavos: 100000, situacao: 'pedido' }],
  montagem: { tipo: 'montadora_propria', situacao: 'recusada', observacao: 'Altura acima de 4 m' },
  equipe: [
    { pessoaId: 'rui', nome: 'Rui', papel: 'responsavel', credencialId: null, credencialRevogada: null },
    { pessoaId: 'tina', nome: 'Tina', papel: 'equipe', credencialId: 'cr1', credencialRevogada: false },
  ],
  contratos: [{ id: 'k1', situacao: 'enviado', via: 'aceite_no_app', valorCentavos: 3600000, corpo: 'Contrato de cessão de espaço na feira do evento. Cláusula única.' }],
  pendencias: ['Monte a sua marca no app.', 'Leia e assine o contrato.'],
};
export const PORTAL_PRONTO: Portal = {
  ...PORTAL,
  resumo: { estandes: 2, areaM2: 45, investimentoCentavos: 3600000, nivel: 'Ouro', credenciaisDireito: 15, proximoNivel: null },
  estandes: [{ id: 'e1', codigo: 'A1', situacao: 'vendido', reservadoAte: null, valorCentavos: 600000, tipo: 'Linha 3x3' }],
  perfil: { nomeExibicao: 'Xis Med', publicado: true },
  montagem: { tipo: 'basica', situacao: 'aprovada', observacao: null },
  contratos: [{ id: 'k1', situacao: 'assinado', via: 'aceite_no_app', valorCentavos: 3600000, corpo: 'Contrato.' }],
  pendencias: [],
};

/** API de mentira: devolve os exemplos e anota as escritas. Cada função pode ser trocada no teste. */
export function apiFalsaAreas(trocas: Partial<ApiAreas> = {}) {
  const feitas: string[] = [];
  const anotar = (nome: string) => async (...args: string[]) => void feitas.push([nome, ...args].join(' '));
  const api: ApiAreas = {
    inicio: async () => INICIO,
    participacoes: async () => [PARTICIPACAO],
    credenciais: async () => CREDENCIAIS,
    hoje: async () => HOJE,
    avisos: async () => [
      { id: 'a1', titulo: 'Troca de sala', corpo: 'A abertura mudou para o Auditório 2.', urgente: true, publicadoEm: '2027-03-01T10:00:00Z' },
      { id: 'a2', titulo: 'Bem-vindos', corpo: 'O credenciamento abre às 7h.', urgente: false, publicadoEm: '2027-03-01T09:00:00Z' },
    ],
    portal: async () => PORTAL,
    mapa: async () => [
      { id: 'e2', codigo: 'A2', situacao: 'livre', tipo: 'Linha 3x3', larguraM: 3, profundidadeM: 3, precoCentavos: 600000 },
      { id: 'e3', codigo: 'A3', situacao: 'vendido', tipo: 'Linha 3x3', larguraM: 3, profundidadeM: 3, precoCentavos: 600000 },
    ],
    aceitarConvite: anotar('aceitar'),
    reservar: anotar('reservar'),
    liberar: anotar('liberar'),
    assinar: anotar('assinar'),
    emitirCredencial: anotar('credencial'),
    ...trocas,
  };
  return { api, feitas };
}
