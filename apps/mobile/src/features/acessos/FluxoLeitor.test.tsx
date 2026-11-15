/** Cenários de 08-local-zonas-e-acessos.feature e de 09 (meia-entrada) no celular da equipe. */
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import type { PropsLeitor } from '../credenciamento/FluxoCredenciamento';
import { ProvedorLeitor } from './ProvedorLeitor';
import { FluxoLeitor } from './FluxoLeitor';
import type { LeituraLocal } from './leitor';
import { AGORA, CRED, INGRESSO_CAIO, PACOTE, qr } from './fixtures';

let proximaLeitura = '';
function LeitorFalso({ onLer }: PropsLeitor) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Simular leitura" onPress={() => onLer(proximaLeitura)}>
      <Text>Câmera</Text>
    </Pressable>
  );
}

function rede() {
  const estado = { online: true, enviadas: [] as LeituraLocal[], conferencias: [] as unknown[] };
  const requisitar = (async (metodo: string, caminho: string, o?: { corpo?: { leituras?: LeituraLocal[] } }) => {
    if (!estado.online) throw new ErroApi(0, 'sem_conexao', 'Sem internet.');
    if (caminho.endsWith('/pacote')) return { status: 200, dados: PACOTE, etag: null };
    if (caminho.endsWith('/conferir')) estado.conferencias.push(o?.corpo);
    else if (metodo === 'POST') estado.enviadas.push(...(o?.corpo?.leituras ?? []));
    return { status: 200, dados: { resultado: [] }, etag: null };
  }) as Requisitor;
  return { estado, requisitar };
}

let n = 0;
async function montar(r = rede(), cofre = cofreEmMemoria(), ponto: string | null = 'Portão 1') {
  const vibrar = jest.fn();
  await render(
    <TemaProvider>
      <ProvedorLeitor slug="jornada-2027" requisitar={r.requisitar} cofre={cofre} gerarId={() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`} agora={() => AGORA}>
        <FluxoLeitor Leitor={LeitorFalso} vibrar={vibrar} onSair={jest.fn()} agora={() => AGORA} />
      </ProvedorLeitor>
    </TemaProvider>,
  );
  await screen.findByRole('header', { name: 'Em que ponto este celular está?' });
  if (ponto) await fireEvent.press(screen.getByRole('radio', { name: ponto }));
  return { ...r, vibrar, cofre };
}

async function ler(texto: string) {
  proximaLeitura = texto;
  await fireEvent.press(screen.getByRole('button', { name: /^(Ler QR|Ler o próximo|Tentar de novo)$/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Simular leitura' }));
}

beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('FluxoLeitor', () => {
  it('sem escolher o ponto não dá para ler; cada ponto diz onde fica e como conta', async () => {
    await montar(rede(), cofreEmMemoria(), null);
    expect(screen.getByRole('button', { name: 'Ler QR' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Portão 1' }).props['accessibilityHint']).toBe('Entrada do evento · vale a primeira entrada');
    expect(screen.getByRole('radio', { name: 'Porta VIP' }).props['accessibilityHint']).toBe('Sala VIP · conta toda passagem');
    await fireEvent.press(screen.getByRole('radio', { name: 'Portão 1' }));
    expect(screen.getByRole('button', { name: 'Ler QR' })).toBeEnabled();
  });

  it('QR da primeira versão do app: "Pode entrar", com categoria, pedido de Libras e meia a conferir', async () => {
    const { estado, vibrar } = await montar();
    await ler(qr({ i: INGRESSO_CAIO }));
    await screen.findByRole('header', { name: 'Pode entrar' });
    expect(screen.getByText('Caio Ponte')).toBeOnTheScreen();
    expect(screen.getByText('Congressista · Meia')).toBeOnTheScreen();
    expect(screen.getByText('Precisa de intérprete de Libras')).toBeOnTheScreen();
    expect(vibrar).toHaveBeenCalledWith('valido');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Pode entrar. Caio Ponte. Congressista · Meia');
    expect(estado.enviadas).toMatchObject([{ credencialId: CRED.caio, resultado: 'liberado', metodo: 'qr', sentido: 'entrada' }]);
    // Meia-entrada: a equipe confere o documento com os olhos e marca.
    await fireEvent.press(screen.getByRole('button', { name: 'Conferido' }));
    await screen.findByText('Conferido. Ficou registrado com o seu nome.');
    expect(estado.conferencias).toEqual([{ resultado: 'confirmada' }]);
  });

  it('a mesma pessoa de novo na entrada: "Já entrou hoje", sem nova leitura na fila', async () => {
    const { estado, vibrar } = await montar();
    await ler(qr({ c: CRED.eva }));
    await screen.findByRole('header', { name: 'Pode entrar' });
    await ler(qr({ c: CRED.eva }));
    await screen.findByRole('header', { name: 'Já entrou hoje' });
    expect(screen.getByText('Primeira entrada hoje às 09:00, em Portão 1.')).toBeOnTheScreen();
    expect(vibrar).toHaveBeenLastCalledWith('repetido');
    expect(estado.enviadas).toHaveLength(1);
  });

  it('zona sem regra para a categoria: "Não entra aqui" em texto, e a leitura barrada também sobe', async () => {
    const { estado, vibrar } = await montar(rede(), cofreEmMemoria(), 'Porta VIP');
    await ler(qr({ i: INGRESSO_CAIO }));
    await screen.findByRole('header', { name: 'Não entra aqui' });
    expect(screen.getByText('Congressista não tem acesso a esta área.')).toBeOnTheScreen();
    expect(vibrar).toHaveBeenCalledWith('invalido');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Não entra aqui. Caio Ponte. Congressista · Meia. Congressista não tem acesso a esta área.');
    expect(estado.enviadas).toMatchObject([{ credencialId: CRED.caio, resultado: 'negado' }]);
  });

  it('credencial cancelada e QR que não é do app', async () => {
    const { estado } = await montar();
    await ler(qr({ c: CRED.cancelada }));
    await screen.findByRole('header', { name: 'Credencial cancelada' });
    expect(screen.getByText('Encaminhe à organização.')).toBeOnTheScreen();
    await ler('https://exemplo.com');
    await screen.findByRole('header', { name: 'QR não reconhecido' });
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
    expect(estado.enviadas).toMatchObject([{ credencialId: CRED.cancelada, resultado: 'negado' }]);
  });

  it('sem internet: decide do mesmo jeito, guarda na fila e envia quando a conexão volta', async () => {
    const r = rede();
    const cofre = cofreEmMemoria();
    await montar(r, cofre);
    r.estado.online = false;
    await ler(qr({ c: CRED.eva }));
    await screen.findByRole('header', { name: 'Pode entrar' });
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }));
    await screen.findByText('1 na fila. Enviamos quando a internet voltar.');
    expect(r.estado.enviadas).toHaveLength(0);
    r.estado.online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar a lista' }));
    await screen.findByText('Tudo enviado.');
    expect(r.estado.enviadas).toHaveLength(1);
  });

  it('meia-entrada sem internet: avisa que a conferência não foi registrada', async () => {
    const r = rede();
    await montar(r);
    await ler(qr({ i: INGRESSO_CAIO }));
    await screen.findByRole('header', { name: 'Pode entrar' });
    r.estado.online = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Não apresentou' }));
    await screen.findByText(/a conferência não foi registrada/);
    r.estado.online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Não apresentou' }));
    await screen.findByText('Registrado como não apresentado. Encaminhe à organização.');
  });

  it('busca pelo nome: liberar à mão exige documento conferido e respeita a regra do ponto', async () => {
    const { estado } = await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar pelo nome' }));
    await fireEvent.changeText(screen.getByLabelText('Nome da pessoa'), 'eva');
    await screen.findByText('1 pessoa encontrada.');
    await fireEvent.press(screen.getByRole('button', { name: 'Eva Lima, Palestrante' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Liberar à mão' }));
    await screen.findByText('Confira um documento com foto antes de liberar à mão.');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Conferi um documento com foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Liberar à mão' }));
    await screen.findByRole('header', { name: 'Pode entrar' });
    expect(estado.enviadas).toMatchObject([{ credencialId: CRED.eva, metodo: 'manual', documentoConferido: true }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o próximo' }));
    await fireEvent.changeText(screen.getByLabelText('Nome da pessoa'), 'zz');
    await screen.findByText('Ninguém com esse nome na lista.');
  });

  it('sem internet e sem lista: explica que precisa baixar uma vez; depois abre pelo que ficou guardado', async () => {
    const r = rede();
    r.estado.online = false;
    const cofre = cofreEmMemoria();
    await render(
      <TemaProvider>
        <ProvedorLeitor slug="jornada-2027" requisitar={r.requisitar} cofre={cofre} gerarId={() => 'x'} agora={() => AGORA}>
          <FluxoLeitor Leitor={LeitorFalso} vibrar={jest.fn()} onSair={jest.fn()} agora={() => AGORA} />
        </ProvedorLeitor>
      </TemaProvider>,
    );
    await screen.findByText(/Precisamos de internet uma vez/);
    r.estado.online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Baixar a lista' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Portão 2' }));
    await screen.unmount();
    r.estado.online = false;
    await montar(r, cofre, null);
    expect(screen.getByRole('radio', { name: 'Portão 2' }).props['accessibilityState']).toMatchObject({ checked: true });
  });
});
