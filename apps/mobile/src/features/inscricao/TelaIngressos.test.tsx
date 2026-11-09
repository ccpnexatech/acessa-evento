import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { ProvedorIngressos } from './ProvedorIngressos';
import { TelaIngressos } from './TelaIngressos';
import { INGRESSO, apiFalsa, semRede } from './fixtures';

async function montar(api = apiFalsa().api, cofre = cofreEmMemoria(), onVerEventos = jest.fn()) {
  await render(
    <TemaProvider>
      <ProvedorIngressos api={api} cofre={cofre}><TelaIngressos onVerEventos={onVerEventos} /></ProvedorIngressos>
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

  it('sem internet, abre o ingresso salvo e avisa', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('ingressos', JSON.stringify([INGRESSO]));
    await montar(apiFalsa(undefined, { ingressos: jest.fn(async () => Promise.reject(semRede())) }).api, cofre);
    expect(await screen.findByText('Sem internet. Seu ingresso continua aqui.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'COCAL 2026' })).toBeTruthy();
  });

  it('sem ingresso, leva aos eventos', async () => {
    const { onVerEventos } = await montar(apiFalsa(undefined, { ingressos: jest.fn(async () => []) }).api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver eventos' }));
    expect(onVerEventos).toHaveBeenCalled();
  });
});
