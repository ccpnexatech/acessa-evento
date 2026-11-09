/** Cenários de 03-agenda-offline.feature na interface, buscando por papel e nome. */
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { ProvedorAgenda } from './ProvedorAgenda';
import { TelaAgenda, TelaDetalhe } from './telas';
import type { Agenda } from './modelo';

const agenda: Agenda = {
  versao: 'v1',
  evento: { id: 'e', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Fortaleza', fuso: 'America/Fortaleza' },
  atividades: [
    { id: 'a1', titulo: 'Abertura', resumo: 'Boas-vindas.', inicio: '2026-07-01T12:00:00Z', fim: '2026-07-01T13:00:00Z', recursos: ['libras', 'legenda'], sala: { nome: 'Auditório', local: 'Térreo', acessibilidade: 'Rampa na entrada' }, palestrantes: [{ nome: 'Ana Lima', cargo: 'Curadora' }] },
    { id: 'a2', titulo: 'Design inclusivo', resumo: null, inicio: '2026-07-01T14:00:00Z', fim: '2026-07-01T15:00:00Z', recursos: ['audiodescricao'], sala: null, palestrantes: [] },
    { id: 'a3', titulo: 'Encerramento', resumo: null, inicio: '2026-07-02T19:00:00Z', fim: '2026-07-02T20:00:00Z', recursos: [], sala: null, palestrantes: [] },
  ],
};
const agora = () => new Date('2026-07-01T12:30:00Z');

function rede(online = true) {
  const chamadas: string[] = [];
  const favs = new Set<string>();
  const requisitar = (async (metodo: string, caminho: string) => {
    chamadas.push(`${metodo} ${caminho}`);
    if (!online) throw new ErroApi(0, 'sem_conexao', 'sem rede');
    if (caminho.endsWith('/agenda')) return { status: 200, dados: agenda, etag: null };
    if (caminho.endsWith('/favoritos')) return { status: 200, dados: { atividades: [...favs] }, etag: null };
    const id = caminho.split('/').pop() ?? '';
    if (metodo === 'PUT') favs.add(id); else favs.delete(id);
    return { status: 204, dados: undefined, etag: null };
  }) as Requisitor;
  return { requisitar, chamadas };
}

async function montar(filho: React.ReactNode, r = rede(), cofre = cofreEmMemoria()) {
  await render(
    <TemaProvider>
      <ProvedorAgenda slug="cocal-2026" requisitar={r.requisitar} cofre={cofre}>{filho}</ProvedorAgenda>
    </TemaProvider>,
  );
  return { r, cofre };
}

describe('TelaAgenda', () => {
  it('mostra o dia do evento com as seções Agora e A seguir', async () => {
    await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} />);
    expect(await screen.findByRole('header', { name: 'Agora · 1 sessão' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'A seguir · 1 sessão' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /1 de julho/i, selected: true })).toBeTruthy();
  });

  it('mostra o que vier no topo, como o atalho do ingresso', async () => {
    await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} topo={<Text>Seu ingresso</Text>} />);
    expect(await screen.findByText('Seu ingresso')).toBeTruthy();
  });

  it('troca de dia pelas abas', async () => {
    await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} />);
    await fireEvent.press(await screen.findByRole('tab', { name: /2 de julho/i }));
    expect(screen.getByRole('button', { name: /Encerramento/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Abertura/ })).toBeNull();
  });

  it('filtra por recurso de acessibilidade e permite limpar', async () => {
    await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} />);
    await fireEvent.press(await screen.findByRole('togglebutton', { name: 'Audiodescrição' }));
    expect(screen.getByRole('button', { name: /Design inclusivo/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Abertura/ })).toBeNull();
    await fireEvent.press(screen.getByRole('togglebutton', { name: /Libras/ }));
    expect(screen.getByRole('header', { name: 'Nenhuma sessão encontrada' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar busca e filtros' }));
    expect(screen.getByRole('button', { name: /Abertura/ })).toBeTruthy();
  });

  it('favoritar marca o botão e envia ao servidor', async () => {
    const { r } = await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} />);
    await fireEvent.press(await screen.findByRole('togglebutton', { name: 'Favoritar Abertura' }));
    await waitFor(() => expect(screen.getByRole('togglebutton', { name: 'Favoritar Abertura' }).props.accessibilityState).toEqual({ checked: true }));
    expect(r.chamadas).toContain('PUT /favoritos/a1');
  });

  it('abre o detalhe pelo cartão', async () => {
    const onAbrir = jest.fn();
    await montar(<TelaAgenda onAbrir={onAbrir} agora={agora} />);
    await fireEvent.press(await screen.findByRole('button', { name: /Design inclusivo/ }));
    expect(onAbrir).toHaveBeenCalledWith('a2');
  });

  it('sem internet, abre a agenda salva e avisa', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('agenda-cocal-2026', JSON.stringify({ agenda, salvaEm: 'ontem' }));
    await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} />, rede(false), cofre);
    expect(await screen.findByText('Sem internet. Você está vendo a última agenda salva.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Abertura/ })).toBeTruthy();
  });

  it('sem internet e sem nada salvo, explica e oferece tentar de novo', async () => {
    await montar(<TelaAgenda onAbrir={jest.fn()} agora={agora} />, rede(false));
    expect(await screen.findByRole('header', { name: 'Agenda indisponível' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });
});

describe('TelaDetalhe', () => {
  it('mostra local, acessibilidade e quem fala', async () => {
    await montar(<TelaDetalhe atividadeId="a1" onVoltar={jest.fn()} />);
    expect(await screen.findByRole('header', { name: 'Abertura' })).toBeTruthy();
    expect(screen.getByText('Rampa na entrada')).toBeTruthy();
    expect(screen.getByLabelText('Recursos: Libras, Legenda')).toBeTruthy();
    expect(screen.getByText(/Ana Lima/)).toBeTruthy();
  });

  it('atividade que saiu da agenda oferece voltar', async () => {
    const onVoltar = jest.fn();
    await montar(<TelaDetalhe atividadeId="xx" onVoltar={onVoltar} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar para a agenda' }));
    expect(onVoltar).toHaveBeenCalled();
  });
});
