/**
 * Leitor por ponto (protótipo "Chegou o dia", tela 3): escolher o ponto, ler o
 * QR, ver o resultado e, se preciso, buscar pelo nome. A resposta chega por
 * texto, símbolo, vibração e leitor de tela, nunca só por cor.
 */
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Tocavel } from '../../shared/ui/Tocavel';
import { Xilo } from '../../shared/xilo/Xilo';
import { Botao, CaixaMarcar, MensagemErro, OpcaoRadio, Paragrafo, Tela } from '../../shared/ui/componentes';
import type { PropsLeitor } from '../credenciamento/FluxoCredenciamento';
import { ORIENTACAO_RECURSO, quando } from '../credenciamento/modelo';
import type { Resultado } from '../credenciamento/modelo';
import { useLeitor } from './ProvedorLeitor';
import { NOME_DA_CATEGORIA, buscarCredencial, explicar } from './leitor';
import type { Credencial, Meia, ResultadoLeitura } from './leitor';

interface Props {
  readonly Leitor: ComponentType<PropsLeitor>;
  readonly vibrar: (tipo: Resultado['tipo']) => void;
  readonly onSair: () => void;
  readonly agora?: () => number;
}

type Modo = { readonly tela: 'inicio' } | { readonly tela: 'leitor' } | { readonly tela: 'busca' }
  | { readonly tela: 'manual'; readonly credencial: Credencial }
  | { readonly tela: 'resultado'; readonly resultado: ResultadoLeitura; readonly voltarPara: 'leitor' | 'busca' };

const VIBRACAO: Readonly<Record<ResultadoLeitura['tipo'], Resultado['tipo']>> = { liberado: 'valido', repetido: 'repetido', negado: 'invalido', invalido: 'invalido' };

export function FluxoLeitor({ Leitor, vibrar, onSair, agora = Date.now }: Props) {
  const l = useLeitor();
  const [modo, setModo] = useState<Modo>({ tela: 'inicio' });
  const mostrar = (resultado: ResultadoLeitura, voltarPara: 'leitor' | 'busca') => {
    vibrar(VIBRACAO[resultado.tipo]);
    setModo({ tela: 'resultado', resultado, voltarPara });
  };

  if (!l.pacote) {
    return (
      <Tela titulo="Leitor">
        {l.carregando ? <ActivityIndicator accessibilityLabel="Baixando a lista do evento" /> : null}
        <MensagemErro texto={l.erro} />
        {!l.carregando ? (
          <>
            <View style={estilos.cena}><Xilo nome="semInternet" largura={200} decorativa /></View>
            <Paragrafo>Precisamos de internet uma vez para baixar a lista do evento. Depois, o leitor funciona sem conexão.</Paragrafo>
            <Botao rotulo="Baixar a lista" onPress={() => void l.atualizar()} />
          </>
        ) : null}
        <Botao variante="texto" rotulo="Voltar" onPress={onSair} />
      </Tela>
    );
  }
  if (modo.tela === 'leitor') return <TelaCamera Leitor={Leitor} onLer={async (t) => mostrar(await l.ler(t), 'leitor')} onVoltar={() => setModo({ tela: 'inicio' })} />;
  if (modo.tela === 'resultado') return <TelaResultado resultado={modo.resultado} agora={agora()} onProximo={() => setModo({ tela: modo.voltarPara })} onInicio={() => setModo({ tela: 'inicio' })} />;
  if (modo.tela === 'busca') return <TelaBusca onEscolher={(c) => setModo({ tela: 'manual', credencial: c })} onVoltar={() => setModo({ tela: 'inicio' })} />;
  if (modo.tela === 'manual') {
    return <TelaManual credencial={modo.credencial} onConfirmar={async () => mostrar(await l.liberarManual(modo.credencial), 'busca')} onVoltar={() => setModo({ tela: 'busca' })} />;
  }
  return <TelaInicio onLer={() => setModo({ tela: 'leitor' })} onBuscar={() => setModo({ tela: 'busca' })} onSair={onSair} />;
}

function StatusFila() {
  const { cores } = useTema();
  const { naFila, conexao } = useLeitor();
  const texto = naFila === 0
    ? conexao === 'offline' ? 'Sem internet. Nada na fila.' : 'Tudo enviado.'
    : `${naFila} na fila${conexao === 'offline' ? '. Enviamos quando a internet voltar.' : '. Enviando…'}`;
  const pendente = naFila > 0 || conexao === 'offline';
  return (
    <View accessibilityLiveRegion="polite" style={[estilos.status, { backgroundColor: pendente ? cores.warning100 : cores.success100 }]}>
      <Text style={[estilos.forte, { color: pendente ? cores.warning700 : cores.success700 }]}>{texto}</Text>
    </View>
  );
}

function TelaInicio({ onLer, onBuscar, onSair }: { onLer: () => void; onBuscar: () => void; onSair: () => void }) {
  const { cores } = useTema();
  const l = useLeitor();
  const pacote = l.pacote;
  if (!pacote) return null;
  const zona = (id: string | null) => (id === null ? 'Entrada do evento' : pacote.zonas.find((z) => z.id === id)?.nome ?? 'Área');
  const baixada = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(pacote.geradoEm));
  return (
    <Tela titulo="Leitor" rodape={<Botao rotulo="Ler QR" desabilitado={!l.ponto} onPress={onLer} />}>
      <Paragrafo>{pacote.evento.nome}</Paragrafo>
      <StatusFila />
      <MensagemErro texto={l.erro} />
      <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Em que ponto este celular está?</Text>
      {pacote.pontos.length === 0 ? <Paragrafo>Nenhum ponto de leitura foi criado. Peça à organização para criar um em "Pontos de leitura".</Paragrafo> : null}
      <View accessibilityRole="radiogroup" style={estilos.grupo}>
        {pacote.pontos.map((p) => (
          <OpcaoRadio
            key={p.id}
            rotulo={p.nome}
            dica={`${zona(p.zonaId)} · ${p.modo === 'entrada_unica' ? 'vale a primeira entrada' : 'conta toda passagem'}`}
            marcado={l.ponto?.id === p.id}
            onPress={() => l.escolherPonto(p.id)}
          />
        ))}
      </View>
      {!l.ponto && pacote.pontos.length > 0 ? <Paragrafo secundario>Escolha o ponto para começar a ler.</Paragrafo> : null}
      <Botao variante="secundario" rotulo="Buscar pelo nome" desabilitado={!l.ponto} onPress={onBuscar} />
      <Paragrafo secundario>{`Lista com ${pacote.credenciais.length === 1 ? '1 credencial' : `${pacote.credenciais.length} credenciais`}, baixada às ${baixada}.`}</Paragrafo>
      <Botao variante="texto" rotulo="Atualizar a lista" onPress={() => void l.atualizar()} />
      <Paragrafo secundario>Não saia da conta com leituras na fila: elas só existem neste aparelho até serem enviadas.</Paragrafo>
      <Botao variante="texto" rotulo="Voltar" onPress={onSair} />
    </Tela>
  );
}

function TelaCamera({ Leitor, onLer, onVoltar }: { Leitor: ComponentType<PropsLeitor>; onLer: (t: string) => void; onVoltar: () => void }) {
  const { cores } = useTema();
  const { ponto } = useLeitor();
  const [lido, setLido] = useState(false);
  return (
    <View style={[estilos.camera, { backgroundColor: cores.surface000 }]}>
      <View style={estilos.cameraTopo}>
        <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>Aponte para o QR</Text>
        <Text style={[estilos.linha, { color: cores.ink600 }]}>{ponto?.nome}</Text>
        <StatusFila />
      </View>
      <View style={estilos.visor}>
        <Leitor
          onLer={(t) => {
            // A câmera dispara várias vezes por segundo: só a primeira leitura conta.
            if (lido) return;
            setLido(true);
            onLer(t);
          }}
        />
      </View>
      <View style={estilos.cameraRodape}>
        <Botao variante="secundario" rotulo="Voltar" onPress={onVoltar} />
      </View>
    </View>
  );
}

function TelaResultado({ resultado: r, agora, onProximo, onInicio }: { resultado: ResultadoLeitura; agora: number; onProximo: () => void; onInicio: () => void }) {
  const { cores } = useTema();
  const bom = r.tipo === 'liberado';
  const fundo = bom ? cores.success100 : r.tipo === 'repetido' ? cores.warning100 : cores.danger100;
  const cor = bom ? cores.success700 : r.tipo === 'repetido' ? cores.warning700 : cores.danger700;
  const explicacao = r.tipo === 'negado' || r.tipo === 'invalido' ? explicar(r) : null;
  const titulo = bom ? 'Pode entrar' : r.tipo === 'repetido' ? (quando(r.anterior.em, agora).startsWith('hoje') ? 'Já entrou hoje' : 'Já entrou') : explicacao?.titulo ?? '';
  const credencial = r.tipo === 'invalido' ? null : r.credencial;
  const linhas = r.tipo === 'repetido' ? [`Primeira entrada ${quando(r.anterior.em, agora)}, em ${r.anterior.onde}.`] : explicacao ? [explicacao.oQueFazer] : [];
  const categoria = credencial ? [NOME_DA_CATEGORIA[credencial.categoria] ?? credencial.categoria, credencial.tipo].filter(Boolean).join(' · ') : null;
  const anuncio = [titulo, credencial?.nome, categoria, ...linhas].filter(Boolean).join('. ');

  // Quem usa leitor de tela na equipe ouve o resultado sem procurar na tela.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(anuncio);
  }, [anuncio]);

  return (
    <Tela titulo={titulo} rodape={<Botao rotulo={r.tipo === 'invalido' ? 'Tentar de novo' : 'Ler o próximo'} onPress={onProximo} />}>
      <View style={[estilos.resultado, { backgroundColor: fundo, borderColor: cor }]}>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={[estilos.simbolo, { color: cor }]}>{bom ? '✓' : r.tipo === 'repetido' ? '!' : '✕'}</Text>
        {credencial ? <Text style={[estilos.nome, { color: cores.ink900 }]}>{credencial.nome}</Text> : null}
        {categoria ? <Text style={[estilos.linha, { color: cores.ink900 }]}>{categoria}</Text> : null}
        {linhas.map((t) => <Text key={t} style={[estilos.linha, { color: cores.ink900 }]}>{t}</Text>)}
      </View>
      {r.tipo === 'liberado' && r.meia ? <ConferenciaDeMeia meia={r.meia} /> : null}
      {bom ? credencial?.recursos.map((rec) => {
        const o = ORIENTACAO_RECURSO[rec];
        return o ? (
          <View key={rec} accessible style={[estilos.cartao, { backgroundColor: cores.primary050, borderColor: cores.primary600 }]}>
            <Text style={[estilos.forte, { color: cores.primary700 }]}>{o.precisa}</Text>
            <Text style={[estilos.linhaEsquerda, { color: cores.ink900 }]}>{o.onde}</Text>
          </View>
        ) : null;
      }) : null}
      <Botao variante="texto" rotulo="Voltar ao início" onPress={onInicio} />
    </Tela>
  );
}

/** Meia-entrada: a equipe olha o documento e marca. Nada é fotografado nem guardado. */
function ConferenciaDeMeia({ meia }: { meia: Meia }) {
  const { cores } = useTema();
  const { conferirMeia } = useLeitor();
  const [feito, setFeito] = useState<'confirmada' | 'recusada' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const marcar = async (resultado: 'confirmada' | 'recusada') => {
    const falha = await conferirMeia(meia.id, resultado);
    setErro(falha);
    if (!falha) setFeito(resultado);
  };
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.warning100, borderColor: cores.warning700 }]}>
      <Text accessibilityRole="header" style={[estilos.forte, { color: cores.warning700 }]}>{`Meia-entrada: conferir ${meia.documento}`}</Text>
      {feito ? (
        <Text accessibilityLiveRegion="polite" style={[estilos.linhaEsquerda, { color: cores.ink900 }]}>
          {feito === 'confirmada' ? 'Conferido. Ficou registrado com o seu nome.' : 'Registrado como não apresentado. Encaminhe à organização.'}
        </Text>
      ) : (
        <>
          <Botao variante="secundario" rotulo="Conferido" onPress={() => void marcar('confirmada')} />
          <Botao variante="texto" rotulo="Não apresentou" onPress={() => void marcar('recusada')} />
        </>
      )}
      <MensagemErro texto={erro} />
    </View>
  );
}

function TelaBusca({ onEscolher, onVoltar }: { onEscolher: (c: Credencial) => void; onVoltar: () => void }) {
  const { cores } = useTema();
  const { pacote } = useLeitor();
  const [termo, setTermo] = useState('');
  const achados = pacote ? buscarCredencial(pacote, termo) : [];
  return (
    <Tela titulo="Buscar pelo nome">
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      <TextInput
        accessibilityLabel="Nome da pessoa"
        placeholder="Digite pelo menos 2 letras"
        placeholderTextColor={cores.ink600}
        value={termo}
        onChangeText={setTermo}
        autoCorrect={false}
        style={[estilos.busca, { backgroundColor: cores.surface100, color: cores.ink900, borderBottomColor: cores.borderControl }]}
      />
      {termo.trim().length >= 2 ? (
        <Text accessibilityLiveRegion="polite" style={[estilos.linhaEsquerda, { color: cores.ink600 }]}>
          {achados.length === 0 ? 'Ninguém com esse nome na lista.' : achados.length === 1 ? '1 pessoa encontrada.' : `${achados.length} pessoas encontradas.`}
        </Text>
      ) : null}
      {achados.map((c) => {
        const categoria = NOME_DA_CATEGORIA[c.categoria] ?? c.categoria;
        return (
          <Tocavel
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.nome}, ${categoria}`}
            onPress={() => onEscolher(c)}
            style={({ pressed }) => [estilos.pessoa, { backgroundColor: cores.surface100, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[estilos.forte, { color: cores.ink900 }]}>{c.nome}</Text>
            <Text style={[estilos.linhaEsquerda, { color: cores.ink600 }]}>{categoria}</Text>
          </Tocavel>
        );
      })}
    </Tela>
  );
}

function TelaManual({ credencial: c, onConfirmar, onVoltar }: { credencial: Credencial; onConfirmar: () => Promise<void>; onVoltar: () => void }) {
  const [conferido, setConferido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const confirmar = async () => {
    if (!conferido) {
      setErro('Confira um documento com foto antes de liberar à mão.');
      return;
    }
    setEnviando(true);
    await onConfirmar();
  };
  return (
    <Tela titulo={c.nome} rodape={<Botao rotulo="Liberar à mão" rotuloCarregando="Registrando…" carregando={enviando} onPress={() => void confirmar()} />}>
      <Botao variante="texto" rotulo="Voltar para a busca" onPress={onVoltar} />
      <Paragrafo>{NOME_DA_CATEGORIA[c.categoria] ?? c.categoria}</Paragrafo>
      <Paragrafo secundario>A liberação à mão fica registrada com o seu nome. A regra do ponto continua valendo.</Paragrafo>
      <CaixaMarcar rotulo="Conferi um documento com foto" marcado={conferido} onMudar={(v) => { setConferido(v); setErro(null); }} erro={erro} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  status: { padding: espaco['3'], borderRadius: raio.md },
  cena: { alignItems: 'center' },
  forte: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  secao: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  grupo: { gap: espaco['2'] },
  camera: { flex: 1 },
  cameraTopo: { padding: espaco['4'], paddingTop: espaco['12'], gap: espaco['2'] },
  visor: { flex: 1, marginHorizontal: espaco['4'], borderRadius: raio.lg, overflow: 'hidden' },
  cameraRodape: { padding: espaco['4'] },
  titulo: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  resultado: { padding: espaco['6'], borderRadius: raio.lg, borderWidth: 3, gap: espaco['2'], alignItems: 'center' },
  simbolo: { fontSize: 64, lineHeight: 72, fontWeight: '700' },
  nome: { fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  linha: { fontSize: 18, lineHeight: 26, textAlign: 'center' },
  linhaEsquerda: { fontSize: 18, lineHeight: 26 },
  cartao: { padding: espaco['4'], borderRadius: raio.lg, borderWidth: 2, gap: espaco['2'] },
  busca: { minHeight: tamanho.touchLg, paddingHorizontal: espaco['3'], fontSize: 18, borderBottomWidth: 2, borderTopLeftRadius: raio.sm, borderTopRightRadius: raio.sm },
  pessoa: { padding: espaco['4'], borderRadius: raio.lg, gap: 2 },
});
