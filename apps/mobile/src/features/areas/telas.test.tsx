/** Troca de visão por papel, "Chegou o dia", credenciais e o espaço do expositor (features 07, 08 e 10). */
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { apiAreas, papeisPorExtenso, periodo, podeLer, reais } from './api';
import { TelaAreas, TelaCredenciais, TelaHoje } from './telas';
import { TelaPortal } from './TelaPortal';
import { HOJE, INICIO, PORTAL_PRONTO, apiFalsaAreas } from './fixtures';

const montar = (tela: React.ReactElement) => render(<TemaProvider>{tela}</TemaProvider>);
beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('Minhas áreas', () => {
  const acoes = () => ({ onHoje: jest.fn(), onLeitor: jest.fn(), onPortal: jest.fn(), onCredenciais: jest.fn(), onVoltar: jest.fn() });

  it('mostra só as visões que a pessoa tem, com o que fazer em cada uma', async () => {
    const a = acoes();
    await montar(<TelaAreas api={apiFalsaAreas().api} {...a} />);
    await screen.findByRole('header', { name: 'Eventos em que você trabalha' });
    expect(screen.getByText('Seus papéis: Dono.')).toBeOnTheScreen();
    expect(screen.getByText('Evento de demonstração.')).toBeOnTheScreen();
    // Quem é só de conteúdo vê o dia do evento, mas não vira leitor.
    expect(screen.getByRole('button', { name: 'Usar este celular como leitor: Jornada 2027' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Usar este celular como leitor: Ensaio geral' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Chegou o dia: Jornada 2027' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar este celular como leitor: Jornada 2027' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir o espaço de Xis Med' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver credenciais e QR' }));
    expect([a.onHoje.mock.calls, a.onLeitor.mock.calls, a.onPortal.mock.calls, a.onCredenciais.mock.calls.length]).toEqual([[['jornada-2027']], [['jornada-2027']], [['pe1']], 1]);
  });

  it('convite: diz para onde é e com quais papéis; aceitar recarrega', async () => {
    const { api, feitas } = apiFalsaAreas();
    await montar(<TelaAreas api={api} {...acoes()} />);
    await screen.findByText('Você foi convidado para a equipe: COCAL 2026');
    expect(screen.getByText('Papéis: Credenciamento, Acessibilidade.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar convite de COCAL 2026' }));
    await screen.findByRole('button', { name: 'Aceitar convite de COCAL 2026' });
    expect(feitas).toEqual(['aceitar c1']);
  });

  it('convite que não vale mais mostra a frase da API; convite de parceiro diz a empresa', async () => {
    const convite = { ...INICIO.convites[0], id: 'c2', parceiro: 'Xis Med', evento: 'Jornada 2027', papeis: ['responsavel'] } as (typeof INICIO.convites)[number];
    const { api } = apiFalsaAreas({
      inicio: async () => ({ eventos: [], convites: [convite] }),
      aceitarConvite: async () => { throw new ErroApi(409, 'regra', 'Este convite não vale mais. Peça um novo a quem convidou.'); },
    });
    await montar(<TelaAreas api={api} {...acoes()} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Aceitar convite de Xis Med, no Jornada 2027' }));
    await screen.findByText('Este convite não vale mais. Peça um novo a quem convidou.');
  });

  it('quem não tem nada vê a explicação; falha de rede oferece tentar de novo', async () => {
    const vazia = apiFalsaAreas({ inicio: async () => ({ eventos: [], convites: [] }), participacoes: async () => [], credenciais: async () => [] });
    const t = await montar(<TelaAreas api={vazia.api} {...acoes()} />);
    await screen.findByText(/ainda não faz parte da equipe de nenhum evento/);
    await t.unmount();
    let falhar = true;
    const instavel = apiFalsaAreas({ inicio: async () => { if (falhar) throw new ErroApi(0, 'sem_conexao', 'Não foi possível falar com o servidor.'); return INICIO; } });
    await montar(<TelaAreas api={instavel.api} {...acoes()} />);
    await screen.findByText('Não foi possível falar com o servidor.');
    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    await screen.findByRole('header', { name: 'Convites' });
  });
});

describe('Chegou o dia', () => {
  it('entradas registradas, o que pede atenção primeiro e cada ponto com o que aconteceu nele', async () => {
    const onLeitor = jest.fn();
    await montar(<TelaHoje api={apiFalsaAreas().api} slug="jornada-2027" onLeitor={onLeitor} onVoltar={jest.fn()} />);
    await screen.findByText('15 entradas registradas');
    expect(screen.getByText('52 credenciais válidas, 40 inscritos.')).toBeOnTheScreen();
    expect(screen.getByText('2 leituras barradas.')).toBeOnTheScreen();
    expect(screen.getByText('Conta quem passou pela entrada, não quem está no local agora.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Pede atenção' })).toBeOnTheScreen();
    expect(screen.getByText('Sem atualizar há 60 min. Peça para abrir o leitor com internet.')).toBeOnTheScreen();
    expect(screen.getByText('12 entradas, 2 barradas.')).toBeOnTheScreen();
    expect(screen.getByText('1 entrada, 1 saída.')).toBeOnTheScreen();
    expect(screen.getByText('Ponto desligado.')).toBeOnTheScreen();
    expect(screen.getByText('Última leitura às 08:54.')).toBeOnTheScreen();
    expect(screen.queryByText(/lotação/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Usar este celular como leitor' }));
    expect(onLeitor).toHaveBeenCalled();
  });

  it('nada pedindo atenção e nenhum ponto criado', async () => {
    const calmo = { ...HOJE, numeros: { inscritos: 1, credenciais: 1, entradas: 1, leiturasNegadas: 1 }, pontos: [] };
    await montar(<TelaHoje api={apiFalsaAreas({ hoje: async () => calmo }).api} slug="jornada-2027" onVoltar={jest.fn()} />);
    await screen.findByText('1 entrada registrada');
    expect(screen.getByText('1 leitura barrada.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Tudo em ordem' })).toBeOnTheScreen();
    expect(screen.getByText(/Nenhum ponto criado ainda/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Usar este celular como leitor' })).toBeNull();
  });
});

describe('Minhas credenciais', () => {
  it('QR de cada credencial válida, aviso urgente em texto e a cancelada sem QR', async () => {
    await montar(<TelaCredenciais api={apiFalsaAreas().api} onVoltar={jest.fn()} />);
    await screen.findByRole('image', { name: 'QR da credencial de Palestrante no Jornada 2027. Mostre na entrada.' });
    expect(screen.getAllByRole('image')).toHaveLength(1);
    expect(screen.getByText('Urgente: Troca de sala')).toBeOnTheScreen();
    expect(screen.getByText('Expositor · Xis Med')).toBeOnTheScreen();
    expect(screen.getByText('Credencial cancelada. Procure a organização.')).toBeOnTheScreen();
  });

  it('aviso que falha não esconde o QR; sem credencial, explica', async () => {
    const t = await montar(<TelaCredenciais api={apiFalsaAreas({ avisos: async () => { throw new Error('caiu'); } }).api} onVoltar={jest.fn()} />);
    await screen.findByRole('image');
    expect(screen.queryByRole('header', { name: 'Avisos' })).toBeNull();
    await t.unmount();
    await montar(<TelaCredenciais api={apiFalsaAreas({ credenciais: async () => [] }).api} onVoltar={jest.fn()} />);
    await screen.findByText('Você ainda não tem credencial em nenhum evento.');
  });
});

describe('Espaço do expositor', () => {
  it('o que fazer agora, reserva com prazo, próximo nível e o que a organização observou', async () => {
    await montar(<TelaPortal api={apiFalsaAreas().api} id="pe1" onVoltar={jest.fn()} />);
    await screen.findByRole('header', { name: 'O que fazer agora' });
    expect(screen.getByText('1. Monte a sua marca no app.')).toBeOnTheScreen();
    expect(screen.getByText('Ainda sem nível')).toBeOnTheScreen();
    expect(screen.getByText(/Faltam R\$\s10\.000,00 em estandes para o nível Prata\./)).toBeOnTheScreen();
    expect(screen.getByText(/Reserva vale até 12 de fev.*Sem contrato assinado, o estande volta a ficar livre\./)).toBeOnTheScreen();
    expect(screen.getByText('Montadora própria: recusada.')).toBeOnTheScreen();
    expect(screen.getByText('Observação da organização: Altura acima de 4 m')).toBeOnTheScreen();
    expect(screen.getByText('As credenciais são liberadas quando o contrato for assinado.')).toBeOnTheScreen();
  });

  it('escolher estande por lista, desistir, assinar só depois de ler e emitir credencial', async () => {
    const { api, feitas } = apiFalsaAreas();
    await montar(<TelaPortal api={api} id="pe1" onVoltar={jest.fn()} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher estande' }));
    // Só os livres entram na lista; o vendido não é oferecido.
    expect(screen.queryByRole('button', { name: 'Reservar o estande A3' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Reservar o estande A2' }));
    await screen.findByText('Estande A2 reservado para você por 48 horas.');
    await fireEvent.press(screen.getByRole('button', { name: 'Desistir do estande A1' }));
    await screen.findByText('Você desistiu do estande A1.');
    expect(screen.getByRole('button', { name: 'Assinar' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o contrato' }));
    expect(screen.getByText(/Cláusula única/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Li o contrato e concordo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Assinar' }));
    await screen.findByText('Contrato assinado. Seus estandes reservados agora são seus.');
    await fireEvent.press(screen.getByRole('button', { name: 'Emitir credencial de Rui' }));
    await screen.findByText('Credencial de Rui emitida. O QR aparece no app dela.');
    expect(feitas).toEqual(['reservar pe1 e2', 'liberar pe1 e1', 'assinar k1', 'credencial pe1 rui']);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar a lista de estandes' }));
  });

  it('estande disputado: mostra a frase da API e atualiza a lista', async () => {
    const { api } = apiFalsaAreas({ reservar: async () => { throw new ErroApi(409, 'conflito', 'Este estande acabou de ser reservado. Escolha outro.'); } });
    await montar(<TelaPortal api={api} id="pe1" onVoltar={jest.fn()} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher estande' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reservar o estande A2' }));
    await screen.findByText('Este estande acabou de ser reservado. Escolha outro.');
  });

  it('tudo pronto: nível, credenciais usadas e contrato assinado; a equipe só enxerga', async () => {
    const equipe = { ...PORTAL_PRONTO, participacao: { ...PORTAL_PRONTO.participacao, papel: 'equipe' }, contratos: [] };
    const t = await montar(<TelaPortal api={apiFalsaAreas({ portal: async () => PORTAL_PRONTO, mapa: async () => { throw new Error('caiu'); } }).api} id="pe1" onVoltar={jest.fn()} />);
    await screen.findByRole('header', { name: 'Tudo pronto' });
    expect(screen.getByText('Nível Ouro')).toBeOnTheScreen();
    expect(screen.getByText('15 credenciais, 1 usada.')).toBeOnTheScreen();
    expect(screen.getByText('Contrato assinado')).toBeOnTheScreen();
    expect(screen.getByText('Montagem básica da feira: aprovada.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher estande' }));
    expect(screen.getByText('Nenhum estande livre no momento.')).toBeOnTheScreen();
    await t.unmount();
    await montar(<TelaPortal api={apiFalsaAreas({ portal: async () => equipe }).api} id="pe1" onVoltar={jest.fn()} />);
    await screen.findByText('A organização ainda não enviou o contrato.');
    expect(screen.queryByRole('button', { name: 'Escolher estande' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Emitir credencial/ })).toBeNull();
  });

  it('espaço de outro expositor: a API responde que não existe', async () => {
    await montar(<TelaPortal api={apiFalsaAreas({ portal: async () => { throw new ErroApi(404, 'nao_encontrado', 'Parceiro não encontrado.'); } }).api} id="pe9" onVoltar={jest.fn()} />);
    await screen.findByText('Parceiro não encontrado.');
  });
});

describe('cliente da API das áreas', () => {
  it('cada chamada vai para a rota documentada', async () => {
    const chamadas: string[] = [];
    const requisitar = (async (metodo: string, caminho: string, o?: { corpo?: unknown }) => {
      chamadas.push(`${metodo} ${caminho}${o?.corpo ? ` ${JSON.stringify(o.corpo)}` : ''}`);
      return { status: 200, dados: { participacoes: [], credenciais: [], avisos: [], estandes: [] }, etag: null };
    }) as Requisitor;
    const api = apiAreas(requisitar);
    await api.inicio(); await api.participacoes(); await api.credenciais(); await api.aceitarConvite('c 1'); await api.hoje('ev'); await api.avisos('ev');
    await api.portal('pe'); await api.mapa('ev'); await api.reservar('pe', 'e1'); await api.liberar('pe', 'e1'); await api.assinar('k1'); await api.emitirCredencial('pe', 'p1');
    expect(chamadas).toEqual([
      'GET /organizador/inicio', 'GET /portal', 'GET /credenciais', 'POST /convites/c%201/aceitar', 'GET /organizador/eventos/ev/hoje', 'GET /eventos/ev/avisos',
      'GET /portal/pe', 'GET /eventos/ev/expositores', 'PUT /portal/pe/estandes/e1', 'DELETE /portal/pe/estandes/e1', 'POST /contratos/k1/assinar {}', 'POST /portal/pe/credenciais {"pessoaId":"p1"}',
    ]);
  });

  it('textos de apoio', () => {
    expect(papeisPorExtenso(['admin', 'novo'])).toBe('Administração, novo');
    expect([podeLer(['conteudo']), podeLer(['operacao'])]).toEqual([false, true]);
    expect(reais(360000).replace(/\s/g, ' ')).toBe('R$ 3.600,00');
    expect([periodo('2027-03-01', '2027-03-03'), periodo('2027-03-01', '2027-03-01')]).toEqual(['1 de mar a 3 de mar', '1 de mar']);
  });
});
