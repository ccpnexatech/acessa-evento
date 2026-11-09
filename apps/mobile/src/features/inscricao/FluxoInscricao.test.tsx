/** Cenários de 02-inscricao-e-pagamento.feature na interface. */
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import { FluxoInscricao } from './FluxoInscricao';
import { EVENTO, INGRESSO, apiFalsa, recusado, semRede } from './fixtures';
import type { Chamada } from './fixtures';
import type { Ingresso } from './modelo';

let n = 0;
const gerarChave = () => `chave-${++n}`;

async function montar(responder?: (c: Chamada) => Ingresso | Error) {
  const { api, chamadas } = apiFalsa(responder);
  const onConcluido = jest.fn();
  await render(
    <TemaProvider>
      <FluxoInscricao evento={EVENTO} api={api} gerarChave={gerarChave} onConcluido={onConcluido} onVerIngresso={jest.fn()} onCancelar={jest.fn()} />
    </TemaProvider>,
  );
  return { chamadas, onConcluido };
}

async function irAtePagamento(recursos: string[] = []) {
  await fireEvent.press(screen.getByRole('radio', { name: /^Congressista/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  for (const r of recursos) await fireEvent.press(screen.getByRole('checkbox', { name: r }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('FluxoInscricao', () => {
  it('ingresso esgotado aparece com "Esgotado" e não pode ser escolhido', async () => {
    await montar();
    const umDia = screen.getByRole('radio', { name: /Um dia/ });
    expect(umDia.props.accessibilityLabel).toContain('Esgotado');
    expect(umDia.props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(screen.getByText('Esgotado')).toBeTruthy();
  });

  it('não avança sem escolher o ingresso', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Escolha um tipo de ingresso.')).toBeTruthy();
  });

  it('Pix aprovado: pede Libras, mostra o aviso de teste e confirma "Você está no COCAL 2026"', async () => {
    const { chamadas, onConcluido } = await montar();
    await irAtePagamento(['Intérprete de Libras']);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Passo 3 de 3, Pagamento');
    expect(screen.getByText('Ambiente de teste. Nenhum dinheiro é cobrado.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar código Pix' }));
    expect(await screen.findByRole('header', { name: 'Você está no COCAL 2026' })).toBeTruthy();
    expect(chamadas[0]?.pedido).toEqual({ tipoIngressoId: 't1', recursos: ['libras'], metodo: 'pix' });
    expect(onConcluido).toHaveBeenCalledWith(INGRESSO);
  });

  it('cartão recusado mostra a mensagem e a próxima tentativa usa outra chave', async () => {
    let vez = 0;
    const { chamadas } = await montar(() => (vez++ === 0 ? recusado() : INGRESSO));
    await irAtePagamento();
    await fireEvent.press(screen.getByRole('radio', { name: 'Cartão de crédito' }));
    await fireEvent.changeText(screen.getByLabelText('Número do cartão'), '4000000000000002');
    await fireEvent.press(screen.getByRole('button', { name: /^Pagar/ }));
    expect(await screen.findByText('Pagamento não aprovado. Tente outro cartão ou pague com Pix.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Pagar/ }));
    await screen.findByRole('header', { name: 'Você está no COCAL 2026' });
    expect(chamadas[0]?.pedido.cartao).toEqual({ numero: '4000000000000002' });
    expect(chamadas[0]?.chave).not.toBe(chamadas[1]?.chave);
  });

  it('cartão com dígito errado não sai do aparelho', async () => {
    const { chamadas } = await montar();
    await irAtePagamento();
    await fireEvent.press(screen.getByRole('radio', { name: 'Cartão de crédito' }));
    await fireEvent.changeText(screen.getByLabelText('Número do cartão'), '4242 4242 4242 4241');
    await fireEvent.press(screen.getByRole('button', { name: /^Pagar/ }));
    expect(screen.getByText('Número de cartão inválido. Confira os dígitos.')).toBeTruthy();
    expect(chamadas).toHaveLength(0);
  });

  it('não cobra duas vezes: depois de cair a internet, tentar de novo usa a mesma chave', async () => {
    let vez = 0;
    const { chamadas } = await montar(() => (vez++ === 0 ? semRede() : INGRESSO));
    await irAtePagamento();
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar código Pix' }));
    expect(await screen.findByText(/Não cobramos duas vezes/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar código Pix' }));
    await screen.findByRole('header', { name: 'Você está no COCAL 2026' });
    expect(chamadas.map((c) => c.chave)).toEqual([chamadas[0]?.chave, chamadas[0]?.chave]);
  });

  it('esgotou durante o pagamento: avisa e pede outro ingresso', async () => {
    await montar(() => new ErroApi(409, 'esgotado', 'O ingresso "Congressista" esgotou.'));
    await irAtePagamento();
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar código Pix' }));
    expect(await screen.findByText('O ingresso "Congressista" esgotou.')).toBeTruthy();
  });
});
