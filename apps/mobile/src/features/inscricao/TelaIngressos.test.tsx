import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { ProvedorIngressos } from './ProvedorIngressos';
import { TelaIngressos } from './TelaIngressos';
import { INGRESSO, apiFalsa, semRede } from './fixtures';
import { screen as tela } from '@testing-library/react-native';

async function montar(api = apiFalsa().api, cofre = cofreEmMemoria(), onVerEventos = jest.fn(), aumentarBrilho?: () => () => void) {
  await render(
    <TemaProvider>
      <ProvedorIngressos api={api} cofre={cofre}><TelaIngressos onVerEventos={onVerEventos} {...(aumentarBrilho ? { aumentarBrilho } : {})} /></ProvedorIngressos>
    </TemaProvider>,
  );
  return { cofre, onVerEventos };
}

describe('TelaIngressos', () => {
  it('mostra o ingresso e guarda no aparelho', async () => {
    const { cofre } = await montar();
    expect(await screen.findByRole('header', { name: 'COCAL 2026' })).toBeTruthy();
    expect(JSON.parse((await cofre.ler('ingressos')) ?? '[]')).toEqual([INGRESSO]);
  });

  it('mostra QR, nome, tipo e "Disponível sem internet", com o brilho no máximo enquanto aberto', async () => {
    const restaurar = jest.fn();
    const aumentar = jest.fn(() => restaurar);
    await montar(apiFalsa().api, cofreEmMemoria(), jest.fn(), aumentar);
    expect(await tela.findByRole('image', { name: /QR do ingresso de Caio Ponte/ })).toBeTruthy();
    expect(tela.getByText('Caio Ponte')).toBeTruthy();
    expect(tela.getByText('Congressista')).toBeTruthy();
    expect(tela.getByText('Disponível sem internet')).toBeTruthy();
    expect(aumentar).toHaveBeenCalledTimes(1);
    await tela.unmount();
    expect(restaurar).toHaveBeenCalled();
  });

  it('mostra "Check-in feito" com hora e portão', async () => {
    const api = apiFalsa(undefined, { ingressos: jest.fn(async () => [{ ...INGRESSO, checkin: { em: '2026-07-01T11:12:00.000Z', portao: 'Portão 1' } }]) }).api;
    await montar(api);
    expect(await tela.findByText('Check-in feito às 08:12, no Portão 1')).toBeTruthy();
  });

  it('sem internet, abre o ingresso salvo e avisa', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('ingressos', JSON.stringify([INGRESSO]));
    await montar(apiFalsa(undefined, { ingressos: jest.fn(async () => Promise.reject(semRede())) }).api, cofre);
    expect(await screen.findByText('Sem internet. Seu ingresso continua valendo.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'COCAL 2026' })).toBeTruthy();
  });

  it('sem ingresso, leva aos eventos', async () => {
    const { onVerEventos } = await montar(apiFalsa(undefined, { ingressos: jest.fn(async () => []) }).api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver eventos' }));
    expect(onVerEventos).toHaveBeenCalled();
  });
});
