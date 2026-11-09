import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { TelaEvento, TelaEventos } from './telas-evento';
import { EVENTO, apiFalsa } from './fixtures';

describe('TelaEventos', () => {
  it('filtra eventos com Libras', async () => {
    const { api } = apiFalsa();
    await render(<TemaProvider><TelaEventos api={api} onAbrir={jest.fn()} /></TemaProvider>);
    expect(await screen.findByRole('button', { name: /^Outro evento/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Com Libras' }));
    expect(await screen.findByRole('button', { name: /^COCAL 2026/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Outro evento/ })).toBeNull();
    expect(api.eventos).toHaveBeenLastCalledWith('libras');
  });

  it('abre o evento pelo cartão', async () => {
    const onAbrir = jest.fn();
    await render(<TemaProvider><TelaEventos api={apiFalsa().api} onAbrir={onAbrir} /></TemaProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: /^COCAL 2026/ }));
    expect(onAbrir).toHaveBeenCalledWith('cocal-2026');
  });

  it('erro de rede oferece tentar de novo', async () => {
    const { api } = apiFalsa(undefined, { eventos: jest.fn().mockRejectedValueOnce(new Error('Sem internet.')).mockResolvedValue([EVENTO]) });
    await render(<TemaProvider><TelaEventos api={api} onAbrir={jest.fn()} /></TemaProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: /^COCAL 2026/ })).toBeTruthy();
  });
});

describe('TelaEvento', () => {
  const props = { slug: 'cocal-2026', onVerIngresso: jest.fn(), onVoltar: jest.fn() };

  it('sem login, mostra datas, local, acessibilidade, programação e "Inscrever-se"', async () => {
    const onInscrever = jest.fn();
    await render(<TemaProvider><TelaEvento {...props} api={apiFalsa().api} jaInscrito={false} onInscrever={onInscrever} /></TemaProvider>);
    expect(await screen.findByRole('header', { name: 'COCAL 2026' })).toBeTruthy();
    expect(screen.getByText(/1 a 3 de julho de 2026/)).toBeTruthy();
    expect(screen.getByText('• Libras')).toBeTruthy();
    expect(screen.getByText('Abertura')).toBeTruthy();
    expect(screen.getByText(/a partir de R\$\s450,00/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Inscrever-se' }));
    expect(onInscrever).toHaveBeenCalled();
  });

  it('quem já está inscrito vê o ingresso em vez de se inscrever de novo', async () => {
    await render(<TemaProvider><TelaEvento {...props} api={apiFalsa().api} jaInscrito onInscrever={jest.fn()} /></TemaProvider>);
    expect(await screen.findByRole('button', { name: 'Ver meu ingresso' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inscrever-se' })).toBeNull();
  });

  it('inscrições fechadas não oferecem o botão', async () => {
    const { api } = apiFalsa(undefined, { evento: jest.fn(async () => ({ ...EVENTO, inscricoesAbertas: false })) });
    await render(<TemaProvider><TelaEvento {...props} api={api} jaInscrito={false} onInscrever={jest.fn()} /></TemaProvider>);
    expect(await screen.findByText('As inscrições estão fechadas.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inscrever-se' })).toBeNull();
  });
});
