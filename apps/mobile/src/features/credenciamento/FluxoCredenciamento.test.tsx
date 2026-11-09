/** Cenários de 04-ingresso-e-credenciamento.feature no aparelho da equipe. */
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { ProvedorCredenciamento } from './ProvedorCredenciamento';
import { FluxoCredenciamento } from './FluxoCredenciamento';
import type { PropsLeitor } from './FluxoCredenciamento';
import type { CheckinLocal } from './modelo';
import { AGORA, ANA, CAIO, PACOTE, token } from './fixtures';

let proximaLeitura = '';
function LeitorFalso({ onLer }: PropsLeitor) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Simular leitura" onPress={() => onLer(proximaLeitura)}>
      <Text>Câmera</Text>
    </Pressable>
  );
}

function rede() {
  const estado = { online: true, enviados: [] as CheckinLocal[] };
  const requisitar = (async (metodo: string, caminho: string, o?: { corpo?: { checkins: CheckinLocal[] } }) => {
    if (!estado.online) throw new ErroApi(0, 'sem_conexao', 'Sem internet.');
    if (caminho.endsWith('/pacote')) return { status: 200, dados: PACOTE, etag: null };
    if (metodo === 'POST') estado.enviados.push(...(o?.corpo?.checkins ?? []));
    return { status: 200, dados: { resultado: [] }, etag: null };
  }) as Requisitor;
  return { estado, requisitar };
}

let n = 0;
async function montar(r = rede(), cofre = cofreEmMemoria()) {
  const vibrar = jest.fn();
  await render(
    <TemaProvider>
      <ProvedorCredenciamento slug="cocal-2026" requisitar={r.requisitar} cofre={cofre} gerarId={() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`} agora={() => AGORA}>
        <FluxoCredenciamento Leitor={LeitorFalso} vibrar={vibrar} onSair={jest.fn()} agora={() => AGORA} />
      </ProvedorCredenciamento>
    </TemaProvider>,
  );
  await screen.findByRole('button', { name: 'Ler QR' });
  return { ...r, vibrar };
}

async function ler(texto: string) {
  proximaLeitura = texto;
  await fireEvent.press(screen.getByRole('button', { name: /^(Ler QR|Ler o próximo|Tentar de novo)$/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Simular leitura' }));
}

beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('FluxoCredenciamento', () => {
  it('check-in válido: "Pode entrar", vibração e o pedido de Libras com a orientação', async () => {
    const { estado, vibrar } = await montar();
    await ler(token(CAIO));
    expect(await screen.findByRole('header', { name: 'Pode entrar' })).toBeTruthy();
    expect(screen.getByText('Caio Ponte')).toBeTruthy();
    expect(screen.getByText('Precisa de intérprete de Libras')).toBeTruthy();
    expect(vibrar).toHaveBeenCalledWith('valido');
    await waitFor(() => expect(estado.enviados).toEqual([expect.objectContaining({ ingressoId: CAIO, portao: 'Portão 1', metodo: 'qr' })]));
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(expect.stringContaining('Pode entrar. Caio Ponte'));
  });

  it('check-in repetido mostra hora e portão do primeiro, com vibração de alerta', async () => {
    const { vibrar } = await montar();
    await ler(token(ANA));
    expect(await screen.findByRole('header', { name: 'Já entrou hoje' })).toBeTruthy();
    expect(screen.getByText('Primeiro check-in hoje às 08:12, no Portão 2.')).toBeTruthy();
    expect(vibrar).toHaveBeenCalledWith('repetido');
  });

  it('o mesmo QR duas vezes neste aparelho: a segunda é "já entrou"', async () => {
    await montar();
    await ler(token(CAIO));
    await screen.findByRole('header', { name: 'Pode entrar' });
    await ler(token(CAIO));
    expect(await screen.findByRole('header', { name: 'Já entrou hoje' })).toBeTruthy();
  });

  it('QR com assinatura inválida: "Ingresso não reconhecido" e a orientação', async () => {
    const { vibrar } = await montar();
    await ler(token(CAIO, { privada: new Uint8Array(32).fill(9) }));
    expect(await screen.findByRole('header', { name: 'Ingresso não reconhecido' })).toBeTruthy();
    expect(screen.getByText('Peça para abrir o ingresso no app ou busque pelo nome.')).toBeTruthy();
    expect(vibrar).toHaveBeenCalledWith('invalido');
  });

  it('sem internet: 12 leituras aceitas, "12 na fila", e a fila zera quando a internet volta', async () => {
    const r = rede();
    await montar(r);
    r.estado.online = false;
    for (let i = 0; i < 12; i++) {
      await ler(token(`01900000-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`));
      await screen.findByRole('header', { name: 'Pode entrar' });
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }));
    expect(await screen.findByText('12 na fila. Enviamos quando a internet voltar.')).toBeTruthy();
    r.estado.online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar a lista' }));
    expect(await screen.findByText('Tudo enviado.')).toBeTruthy();
    expect(r.estado.enviados).toHaveLength(12);
  });

  it('check-in manual: busca pelo nome, exige documento e vai para a fila como manual', async () => {
    const { estado } = await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar pelo nome' }));
    await fireEvent.changeText(screen.getByLabelText('Nome do participante'), 'Caio');
    expect(screen.getByText('1 pessoa encontrada.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Caio Ponte, Congressista' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fazer check-in manual' }));
    expect(screen.getByText('Confira um documento com foto antes do check-in manual.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Conferi um documento com foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fazer check-in manual' }));
    expect(await screen.findByRole('header', { name: 'Pode entrar' })).toBeTruthy();
    await waitFor(() => expect(estado.enviados).toEqual([expect.objectContaining({ ingressoId: CAIO, metodo: 'manual', documentoConferido: true })]));
  });

  it('troca de portão fica guardada para as próximas leituras', async () => {
    const { estado } = await montar();
    await fireEvent.changeText(screen.getByLabelText('Portão'), 'Portão 3');
    await ler(token(CAIO));
    await waitFor(() => expect(estado.enviados[0]?.portao).toBe('Portão 3'));
  });
});

describe('sem lista no aparelho', () => {
  it('sem internet na primeira vez, explica e oferece baixar', async () => {
    const r = rede();
    r.estado.online = false;
    await render(
      <TemaProvider>
        <ProvedorCredenciamento slug="cocal-2026" requisitar={r.requisitar} cofre={cofreEmMemoria()} gerarId={() => 'x'}>
          <FluxoCredenciamento Leitor={LeitorFalso} vibrar={jest.fn()} onSair={jest.fn()} />
        </ProvedorCredenciamento>
      </TemaProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Baixar a lista' })).toBeTruthy();
    r.estado.online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Baixar a lista' }));
    expect(await screen.findByRole('button', { name: 'Ler QR' })).toBeTruthy();
  });
});
