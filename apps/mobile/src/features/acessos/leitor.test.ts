/** Cenários de 08-local-zonas-e-acessos.feature decididos no aparelho, sem internet. */
import { verificadorNoble } from '../credenciamento/verificador';
import { avaliarLeitura, buscarCredencial, explicar } from './leitor';
import type { Credencial, LeituraLocal, Ponto, ResultadoLeitura, Zona } from './leitor';
import { AGORA, CRED, INGRESSO_CAIO, PACOTE, PONTO, qr } from './fixtures';

const verificador = verificadorNoble(PACOTE.chaves);
const [CAIO] = PACOTE.credenciais as [Credencial, ...Credencial[]];
const VIP = PACOTE.zonas.find((z) => !z.aberta) as Zona;
const ponto = (id: string): Ponto => PACOTE.pontos.find((p) => p.id === id) as Ponto;
const ler = (texto: string, onde: string, locais: LeituraLocal[] = [], pacote = PACOTE) => avaliarLeitura(texto, ponto(onde), pacote, verificador, locais, AGORA);
const feita = (credencialId: string, pontoId: string, extra: Partial<LeituraLocal> = {}): LeituraLocal =>
  ({ id: `l-${credencialId}-${pontoId}`, credencialId, pontoId, sentido: 'entrada', resultado: 'liberado', metodo: 'qr', feitoEm: '2027-03-01T11:30:00.000Z', ...extra });

describe('leitor por ponto', () => {
  it('QR de ingresso da primeira versão do app entra como congressista, com a meia a conferir', () => {
    const r = ler(qr({ i: INGRESSO_CAIO }), PONTO.portao1);
    expect(r).toMatchObject({ tipo: 'liberado', credencial: { nome: 'Caio Ponte', categoria: 'congressista' }, meia: { documento: 'carteira de estudante' } });
  });

  it('QR de credencial sem ingresso é achado pelo id da credencial', () => {
    expect(ler(qr({ c: CRED.eva }), PONTO.portao1)).toMatchObject({ tipo: 'liberado', credencial: { nome: 'Eva Lima' }, meia: null });
  });

  it('entrada do evento vale a primeira: "já entrou" pelo que o servidor sabia ou pelo que este aparelho leu', () => {
    expect(ler(qr({ c: CRED.duda }), PONTO.portao1)).toEqual({ tipo: 'repetido', credencial: PACOTE.credenciais[1], anterior: { em: '2027-03-01T10:00:00.000Z', onde: 'Portão 2' } });
    const r = ler(qr({ i: INGRESSO_CAIO }), PONTO.portao2, [feita(CRED.caio, PONTO.portao1)]);
    expect(r).toMatchObject({ tipo: 'repetido', anterior: { em: '2027-03-01T11:30:00.000Z', onde: 'Portão 1' } });
    // Leitura barrada, saída e leitura de outra área não contam como entrada no evento.
    const naoContam = [feita(CRED.caio, PONTO.portao1, { resultado: 'negado' }), feita(CRED.caio, PONTO.portao1, { sentido: 'saida' }), feita(CRED.caio, PONTO.salaVip), feita(CRED.caio, 'ponto-apagado')];
    expect(ler(qr({ i: INGRESSO_CAIO }), PONTO.portao2, naoContam).tipo).toBe('liberado');
  });

  it('zona: só a categoria com regra entra; passagem livre conta todas, entrada única só a primeira', () => {
    expect(ler(qr({ i: INGRESSO_CAIO }), PONTO.portaVip)).toMatchObject({ tipo: 'negado', motivo: 'sem_regra' });
    expect(ler(qr({ c: CRED.eva }), PONTO.portaVip, [feita(CRED.eva, PONTO.portaVip)]).tipo).toBe('liberado');
    expect(ler(qr({ c: CRED.eva }), PONTO.salaVip, [feita(CRED.eva, PONTO.salaVip)]).tipo).toBe('repetido');
    // A entrada no evento que o servidor conhece não vale como entrada na zona; e a meia só se confere na entrada do evento.
    expect(ler(qr({ c: CRED.duda }), PONTO.salaVip, [], { ...PACOTE, zonas: [{ ...VIP, aberta: true }] })).toMatchObject({ tipo: 'liberado', meia: null });
  });

  it('credencial cancelada é barrada pela lista, mesmo com assinatura boa', () => {
    expect(ler(qr({ c: CRED.cancelada }), PONTO.portao1)).toMatchObject({ tipo: 'negado', motivo: 'credencial_revogada' });
  });

  it('ingresso cancelado e recomprado: vale a credencial ativa', () => {
    const pacote = { ...PACOTE, credenciais: [{ ...CAIO, id: 'antiga', revogada: true }, ...PACOTE.credenciais] };
    expect(ler(qr({ i: INGRESSO_CAIO }), PONTO.portao1, [], pacote)).toMatchObject({ tipo: 'liberado', credencial: { id: CRED.caio } });
    expect(ler(qr({ i: INGRESSO_CAIO }), PONTO.portao1, [], { ...PACOTE, credenciais: [{ ...CAIO, revogada: true }] })).toMatchObject({ tipo: 'negado', motivo: 'credencial_revogada' });
  });

  it('QR inválido, vencido, de outro evento e credencial fora da lista', () => {
    expect(ler('https://exemplo.com', PONTO.portao1)).toEqual({ tipo: 'invalido', motivo: 'formato' });
    expect(ler(qr({ c: CRED.eva }, { validade: AGORA / 1000 - 1 }), PONTO.portao1)).toEqual({ tipo: 'invalido', motivo: 'vencido' });
    expect(ler(qr({ c: CRED.eva }, { evento: 'outro' }), PONTO.portao1)).toEqual({ tipo: 'invalido', motivo: 'outro_evento' });
    expect(ler(qr({ c: 'credencial-nova' }), PONTO.portao1)).toEqual({ tipo: 'invalido', motivo: 'desconhecida' });
    expect(ler(qr({ i: 'ingresso-novo' }), PONTO.portao1)).toEqual({ tipo: 'invalido', motivo: 'desconhecida' });
  });

  it('ponto de uma zona que o aparelho não conhece pede sincronização', () => {
    const r = avaliarLeitura(qr({ c: CRED.eva }), { ...ponto(PONTO.portaVip), zonaId: 'zona-nova' }, PACOTE, verificador, [], AGORA);
    expect(r).toMatchObject({ tipo: 'negado', motivo: 'zona_desconhecida' });
  });

  it('toda leitura que não libera tem título e o que fazer, em texto', () => {
    const casos: [Exclude<ResultadoLeitura, { tipo: 'liberado' | 'repetido' }>, RegExp, RegExp][] = [
      [{ tipo: 'negado', credencial: CAIO, motivo: 'sem_regra' }, /Não entra aqui/, /Congressista não tem acesso/],
      [{ tipo: 'negado', credencial: { ...CAIO, categoria: 'nova' }, motivo: 'sem_regra' }, /Não entra aqui/, /Esta categoria/],
      [{ tipo: 'negado', credencial: CAIO, motivo: 'credencial_revogada' }, /Credencial cancelada/, /Encaminhe à organização/],
      [{ tipo: 'negado', credencial: CAIO, motivo: 'excecao' }, /Não entra aqui/, /barrou esta pessoa/],
      [{ tipo: 'negado', credencial: CAIO, motivo: 'zona_desconhecida' }, /Ponto desatualizado/, /Sincronize/],
      [{ tipo: 'invalido', motivo: 'vencido' }, /QR vencido/, /abrir o app com internet/],
      [{ tipo: 'invalido', motivo: 'outro_evento' }, /outro evento/, /deste evento/],
      [{ tipo: 'invalido', motivo: 'desconhecida' }, /Fora da lista/, /Sincronize/],
      [{ tipo: 'invalido', motivo: 'assinatura' }, /não reconhecido/, /busque a pessoa pelo nome/],
    ];
    for (const [r, titulo, fazer] of casos) {
      const e = explicar(r);
      expect(e.titulo).toMatch(titulo);
      expect(e.oQueFazer).toMatch(fazer);
    }
  });

  it('busca pelo nome ignora acento e deixa de fora as canceladas', () => {
    expect(buscarCredencial(PACOTE, 'caío').map((c) => c.nome)).toEqual(['Caio Ponte']);
    expect(buscarCredencial(PACOTE, 'rui')).toEqual([]);
    expect(buscarCredencial(PACOTE, 'c')).toEqual([]);
  });
});
