/**
 * 06-acessibilidade.feature: "Toda tela passa nos testes automáticos nos 3 temas".
 * Cada tela é montada com dados de exemplo e auditada em claro, escuro e alto
 * contraste: nome e papel, alvo de 48 pt, contraste de texto e nenhum corte.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { cores, temas } from '@acessa-evento/tokens';
import type { Tema } from '@acessa-evento/tokens';
import { TemaProvider } from '../shared/tema/TemaProvider';
import { ErroApi } from '../shared/api/cliente';
import type { Requisitor } from '../shared/api/cliente';
import { cofreEmMemoria } from '../shared/armazenamento/cofre';
import { sessaoEmMemoria } from '../features/acesso/sessao';
import type { ApiAcesso } from '../features/acesso/api';
import { FluxoAcesso } from '../features/acesso/FluxoAcesso';
import { ProvedorAgenda } from '../features/agenda/ProvedorAgenda';
import { TelaAgenda, TelaDetalhe } from '../features/agenda/telas';
import type { Agenda } from '../features/agenda/modelo';
import { TelaEvento, TelaEventos } from '../features/inscricao/telas-evento';
import { FluxoInscricao } from '../features/inscricao/FluxoInscricao';
import { ProvedorIngressos } from '../features/inscricao/ProvedorIngressos';
import { TelaIngressos } from '../features/inscricao/TelaIngressos';
import { EVENTO, INGRESSO, apiFalsa } from '../features/inscricao/fixtures';
import { TelaAjuda } from '../features/ajuda/TelaAjuda';
import { TelaAssistente } from '../features/assistente/TelaAssistente';
import { ASSISTENTE } from '../features/assistente/fixtures';
import { ProvedorCredenciamento } from '../features/credenciamento/ProvedorCredenciamento';
import { FluxoCredenciamento } from '../features/credenciamento/FluxoCredenciamento';
import type { PropsLeitor } from '../features/credenciamento/FluxoCredenciamento';
import { AGORA, CAIO, PACOTE, token } from '../features/credenciamento/fixtures';
import { auditar, descrever } from './auditoria';
import type { No } from './auditoria';

const AGENDA: Agenda = {
  versao: 'v1',
  evento: { id: 'e', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Fortaleza', fuso: 'America/Fortaleza' },
  atividades: [
    { id: 'a1', titulo: 'Abertura', resumo: 'Boas-vindas.', inicio: '2026-07-01T12:00:00Z', fim: '2026-07-01T13:00:00Z', recursos: ['libras', 'legenda'], sala: { nome: 'Auditório', local: 'Térreo', acessibilidade: 'Rampa na entrada' }, palestrantes: [{ nome: 'Ana Lima', cargo: 'Curadora' }] },
    { id: 'a2', titulo: 'Design inclusivo', resumo: null, inicio: '2026-07-01T14:00:00Z', fim: '2026-07-01T15:00:00Z', recursos: ['audiodescricao'], sala: null, palestrantes: [] },
  ],
};

const redeAgenda = (async (_m: string, caminho: string) => {
  if (caminho.endsWith('/agenda')) return { status: 200, dados: AGENDA, etag: null };
  if (caminho.endsWith('/favoritos')) return { status: 200, dados: { atividades: ['a1'] }, etag: null };
  if (caminho.endsWith('/pacote')) return { status: 200, dados: PACOTE, etag: null };
  return { status: 204, dados: undefined, etag: null };
}) as Requisitor;

const apiAcesso = {
  pedirCodigo: jest.fn(async () => undefined),
  entrar: jest.fn(async () => ({ token: 't', conta: { id: 'p', email: 'a@b.co', nomeCracha: null, primeiroAcessoPendente: true, versaoTermos: 'v' } })),
  obterConta: jest.fn(),
  concluirPrimeiroAcesso: jest.fn(),
  sair: jest.fn(),
  exportar: jest.fn(),
  excluir: jest.fn(),
} as unknown as ApiAcesso;

function LeitorFalso({ onLer }: PropsLeitor) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Simular leitura" style={{ minHeight: 48 }} onPress={() => onLer(token(CAIO))}>
      <Text>Câmera</Text>
    </Pressable>
  );
}

const servicoAssistente = { salvo: async () => ASSISTENTE, sincronizar: async () => ASSISTENTE, avaliar: async () => undefined, enviarPendentes: async () => 0 };

interface Caso {
  readonly tela: string;
  readonly montar: () => ReactNode;
  /** Espera a tela ficar pronta e, se preciso, navega até o estado auditado. */
  readonly preparar: () => Promise<unknown>;
}

const CASOS: readonly Caso[] = [
  { tela: 'Entrar', montar: () => <FluxoAcesso api={apiAcesso} sessao={sessaoEmMemoria()} onPronto={jest.fn()} onExplorar={jest.fn()} />, preparar: () => screen.findByRole('button', { name: 'Receber código' }) },
  {
    tela: 'Agenda',
    montar: () => <ProvedorAgenda slug="cocal-2026" requisitar={redeAgenda} cofre={cofreEmMemoria()}><TelaAgenda onAbrir={jest.fn()} agora={() => new Date('2026-07-01T12:30:00Z')} /></ProvedorAgenda>,
    preparar: () => screen.findByRole('header', { name: /^Agora/ }),
  },
  {
    tela: 'Detalhe da palestra',
    montar: () => <ProvedorAgenda slug="cocal-2026" requisitar={redeAgenda} cofre={cofreEmMemoria()}><TelaDetalhe atividadeId="a1" onVoltar={jest.fn()} /></ProvedorAgenda>,
    preparar: () => screen.findByRole('header', { name: 'Abertura' }),
  },
  { tela: 'Eventos', montar: () => <TelaEventos api={apiFalsa().api} onAbrir={jest.fn()} />, preparar: () => screen.findByRole('button', { name: /^COCAL 2026/ }) },
  { tela: 'Página do evento', montar: () => <TelaEvento slug="cocal-2026" api={apiFalsa().api} jaInscrito={false} onInscrever={jest.fn()} onVerIngresso={jest.fn()} onVoltar={jest.fn()} />, preparar: () => screen.findByRole('button', { name: 'Inscrever-se' }) },
  {
    tela: 'Escolha do ingresso',
    montar: () => <FluxoInscricao evento={EVENTO} api={apiFalsa().api} gerarChave={() => 'chave'} onConcluido={jest.fn()} onVerIngresso={jest.fn()} onCancelar={jest.fn()} />,
    preparar: () => screen.findByRole('radio', { name: /Um dia/ }),
  },
  {
    tela: 'Pagamento',
    montar: () => <FluxoInscricao evento={EVENTO} api={apiFalsa().api} gerarChave={() => 'chave'} onConcluido={jest.fn()} onVerIngresso={jest.fn()} onCancelar={jest.fn()} />,
    preparar: async () => {
      await fireEvent.press(await screen.findByRole('radio', { name: /^Congressista/ }));
      await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Intérprete de Libras' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Cartão de crédito' }));
    },
  },
  {
    tela: 'Ingresso',
    montar: () => <ProvedorIngressos api={apiFalsa(undefined, { ingressos: jest.fn(async () => [{ ...INGRESSO, checkin: { em: '2026-07-01T11:12:00.000Z', portao: 'Portão 1' } }]) }).api} cofre={cofreEmMemoria()}><TelaIngressos onVerEventos={jest.fn()} /></ProvedorIngressos>,
    preparar: () => screen.findByRole('image', { name: /QR do ingresso/ }),
  },
  { tela: 'Ajuda', montar: () => <TelaAjuda nome="Ana" onSair={jest.fn()} onVerEventos={jest.fn()} onAssistente={jest.fn()} onCredenciamento={jest.fn()} />, preparar: () => screen.findByRole('radio', { name: 'Como o sistema' }) },
  {
    tela: 'Assistente do evento',
    montar: () => <TelaAssistente servico={servicoAssistente} abrirLink={jest.fn()} onFechar={jest.fn()} />,
    preparar: () => screen.findByRole('button', { name: 'Acessibilidade' }),
  },
  {
    tela: 'Resposta do assistente',
    montar: () => <TelaAssistente servico={servicoAssistente} abrirLink={jest.fn()} onFechar={jest.fn()} />,
    preparar: async () => {
      await fireEvent.press(await screen.findByRole('button', { name: 'Acessibilidade' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Intérprete de Libras' }));
    },
  },
  {
    tela: 'Leitor de QR',
    montar: () => <ProvedorCredenciamento slug="cocal-2026" requisitar={redeAgenda} cofre={cofreEmMemoria()} gerarId={() => '00000000-0000-4000-8000-000000000001'} agora={() => AGORA}><FluxoCredenciamento Leitor={LeitorFalso} vibrar={jest.fn()} onSair={jest.fn()} agora={() => AGORA} /></ProvedorCredenciamento>,
    preparar: async () => {
      await fireEvent.press(await screen.findByRole('button', { name: 'Ler QR' }));
      await screen.findByRole('button', { name: 'Simular leitura' });
    },
  },
  {
    tela: 'Resultado do check-in',
    montar: () => <ProvedorCredenciamento slug="cocal-2026" requisitar={redeAgenda} cofre={cofreEmMemoria()} gerarId={() => '00000000-0000-4000-8000-000000000001'} agora={() => AGORA}><FluxoCredenciamento Leitor={LeitorFalso} vibrar={jest.fn()} onSair={jest.fn()} agora={() => AGORA} /></ProvedorCredenciamento>,
    preparar: async () => {
      await fireEvent.press(await screen.findByRole('button', { name: 'Ler QR' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Simular leitura' }));
      await screen.findByRole('header', { name: 'Pode entrar' });
    },
  },
];

const MATRIZ = CASOS.flatMap((c) => temas.map((t) => [c.tela, t, c] as const));

beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('auditoria de acessibilidade', () => {
  it.each(MATRIZ)('%s no tema %s: sem violações', async (_tela, tema: Tema, caso) => {
    await render(<TemaProvider temaForcado={tema}>{caso.montar()}</TemaProvider>);
    await caso.preparar();
    const violacoes = auditar(screen.toJSON() as No | No[] | null, cores[tema].surface000);
    expect(descrever(violacoes)).toBe('');
  });

  it('o auditor pega controle sem nome, alvo pequeno, contraste baixo e texto cortado', async () => {
    await render(
      <>
        {/* Controles quebrados de propósito, para provar que o auditor os pega. */}
        {/* eslint-disable-next-line acessibilidade/toque-com-nome */}
        <Pressable accessibilityRole="button" style={{ height: 30 }} onPress={jest.fn()} />
        {/* eslint-disable-next-line acessibilidade/toque-com-papel */}
        <Pressable onPress={jest.fn()} style={{ minHeight: 48 }}><Text>Sem papel</Text></Pressable>
        <Text style={{ color: '#999999', fontSize: 16 }}>Cinza claro</Text>
        <Text numberOfLines={1} style={{ color: '#000000' }}>Título cortado</Text>
      </>,
    );
    const regras = auditar(screen.toJSON() as No | No[] | null, '#ffffff').map((v) => v.regra).sort();
    expect(regras).toEqual(['alvo', 'contraste', 'corte', 'nome', 'papel']);
  });
});

describe('fonte em 200% e movimento', () => {
  it('nenhum texto do app limita linhas nem a escala da fonte', () => {
    const raiz = path.join(__dirname, '..');
    const arquivos: string[] = [];
    const andar = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory() && e.name !== 'testes') andar(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) arquivos.push(p);
      }
    };
    andar(raiz);
    const proibido = /numberOfLines|ellipsizeMode|maxFontSizeMultiplier|allowFontScaling=\{false\}|\bAnimated\b|LayoutAnimation/;
    const achados = arquivos.filter((a) => proibido.test(fs.readFileSync(a, 'utf8'))).map((a) => path.relative(raiz, a));
    expect(achados).toEqual([]);
    // Todo toque passa pelo Tocavel, que tem o anel de foco: nada de Pressable solto.
    const soltos = arquivos.filter((a) => !a.endsWith('Tocavel.tsx') && /<Pressable\b/.test(fs.readFileSync(a, 'utf8'))).map((a) => path.relative(raiz, a));
    expect(soltos).toEqual([]);
  });
});

it('sem violações também nos estados de erro e sem internet', async () => {
  const offline = (async () => { throw new ErroApi(0, 'sem_conexao', 'Sem internet.'); }) as Requisitor;
  for (const tema of temas) {
    await render(<TemaProvider temaForcado={tema}><ProvedorAgenda slug="cocal-2026" requisitar={offline} cofre={cofreEmMemoria()}><TelaAgenda onAbrir={jest.fn()} /></ProvedorAgenda></TemaProvider>);
    await screen.findByRole('header', { name: 'Agenda indisponível' });
    expect(descrever(auditar(screen.toJSON() as No | No[] | null, cores[tema].surface000))).toBe('');
  }
});
