/**
 * Credenciamento da equipe (protótipo C1 a C3): início com portão e fila,
 * leitor de QR, resultado e busca manual. A câmera e a vibração chegam por
 * props (portas), para a tela ser testada sem aparelho.
 */
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao, CaixaMarcar, CampoTexto, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { useCredenciamento } from './ProvedorCredenciamento';
import { ORIENTACAO_RECURSO, buscarPorNome, quando } from './modelo';
import type { Participante, Resultado } from './modelo';

export interface PropsLeitor {
  /** Chamado uma vez por QR lido. */
  readonly onLer: (texto: string) => void;
}

interface Props {
  readonly Leitor: ComponentType<PropsLeitor>;
  readonly vibrar: (tipo: Resultado['tipo']) => void;
  readonly onSair: () => void;
  readonly agora?: () => number;
}

type Modo = { readonly tela: 'inicio' } | { readonly tela: 'leitor' } | { readonly tela: 'busca' }
  | { readonly tela: 'manual'; readonly participante: Participante }
  | { readonly tela: 'resultado'; readonly resultado: Resultado; readonly voltarPara: 'leitor' | 'busca' };

const TEXTO_INVALIDO: Readonly<Record<Extract<Resultado, { tipo: 'invalido' }>['motivo'], string>> = {
  formato: 'O código lido não é um ingresso do app.',
  assinatura: 'A assinatura do ingresso não confere.',
  vencido: 'Este ingresso está fora da validade.',
  outro_evento: 'Este ingresso é de outro evento.',
};

export function FluxoCredenciamento({ Leitor, vibrar, onSair, agora = Date.now }: Props) {
  const c = useCredenciamento();
  const [modo, setModo] = useState<Modo>({ tela: 'inicio' });

  const mostrar = (resultado: Resultado, voltarPara: 'leitor' | 'busca') => {
    vibrar(resultado.tipo);
    setModo({ tela: 'resultado', resultado, voltarPara });
  };

  if (!c.pacote) {
    return (
      <Tela titulo="Credenciamento">
        {c.carregando ? <ActivityIndicator accessibilityLabel="Baixando a lista do evento" /> : null}
        <MensagemErro texto={c.erro} />
        {!c.carregando ? (
          <>
            <Paragrafo>Precisamos de internet uma vez para baixar a lista do evento. Depois, o leitor funciona sem conexão.</Paragrafo>
            <Botao rotulo="Baixar a lista" onPress={() => void c.baixarPacote()} />
          </>
        ) : null}
        <Botao variante="texto" rotulo="Voltar" onPress={onSair} />
      </Tela>
    );
  }

  if (modo.tela === 'leitor') {
    return <TelaLeitor Leitor={Leitor} onLer={async (t) => mostrar(await c.ler(t), 'leitor')} onVoltar={() => setModo({ tela: 'inicio' })} />;
  }
  if (modo.tela === 'resultado') {
    return <TelaResultado resultado={modo.resultado} agora={agora()} onProximo={() => setModo({ tela: modo.voltarPara })} onInicio={() => setModo({ tela: 'inicio' })} />;
  }
  if (modo.tela === 'busca') {
    return <TelaBusca onEscolher={(p) => setModo({ tela: 'manual', participante: p })} onVoltar={() => setModo({ tela: 'inicio' })} agora={agora()} />;
  }
  if (modo.tela === 'manual') {
    return (
      <TelaManual
        participante={modo.participante}
        onConfirmar={async () => mostrar(await c.checkinManual(modo.participante.ingressoId), 'busca')}
        onVoltar={() => setModo({ tela: 'busca' })}
      />
    );
  }
  return <TelaInicio onLer={() => setModo({ tela: 'leitor' })} onBuscar={() => setModo({ tela: 'busca' })} onSair={onSair} />;
}

function StatusFila() {
  const { cores } = useTema();
  const { naFila, conexao } = useCredenciamento();
  const texto = naFila === 0
    ? conexao === 'offline' ? 'Sem internet. Nada na fila.' : 'Tudo enviado.'
    : `${naFila} na fila${conexao === 'offline' ? '. Enviamos quando a internet voltar.' : '. Enviando…'}`;
  const pendente = naFila > 0 || conexao === 'offline';
  return (
    <View accessibilityLiveRegion="polite" style={[estilos.status, { backgroundColor: pendente ? cores.warning100 : cores.success100 }]}>
      <Text style={[estilos.statusTexto, { color: pendente ? cores.warning700 : cores.success700 }]}>{texto}</Text>
    </View>
  );
}

function TelaInicio({ onLer, onBuscar, onSair }: { onLer: () => void; onBuscar: () => void; onSair: () => void }) {
  const c = useCredenciamento();
  const pacote = c.pacote;
  if (!pacote) return null;
  const baixada = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(pacote.geradoEm));
  return (
    <Tela titulo="Credenciamento" rodape={<Botao rotulo="Ler QR" onPress={onLer} />}>
      <Paragrafo>{pacote.evento.nome}</Paragrafo>
      <StatusFila />
      <MensagemErro texto={c.erro} />
      <CampoTexto rotulo="Portão" dica="Aparece no relatório e para quem já entrou." value={c.portao} onChangeText={c.definirPortao} maxLength={40} />
      <Botao variante="secundario" rotulo="Buscar pelo nome" onPress={onBuscar} />
      <Paragrafo secundario>{`Lista com ${pacote.participantes.length === 1 ? '1 participante' : `${pacote.participantes.length} participantes`}, baixada às ${baixada}.`}</Paragrafo>
      <Botao variante="texto" rotulo="Atualizar a lista" onPress={() => void c.sincronizar().then(c.baixarPacote)} />
      <Paragrafo secundario>Não saia da conta com check-ins na fila: eles só existem neste aparelho até serem enviados.</Paragrafo>
      <Botao variante="texto" rotulo="Voltar" onPress={onSair} />
    </Tela>
  );
}

function TelaLeitor({ Leitor, onLer, onVoltar }: { Leitor: ComponentType<PropsLeitor>; onLer: (t: string) => void; onVoltar: () => void }) {
  const { cores } = useTema();
  const [lido, setLido] = useState(false);
  return (
    <View style={[estilos.leitor, { backgroundColor: cores.surface000 }]}>
      <View style={estilos.leitorTopo}>
        <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>Aponte para o QR</Text>
        <StatusFila />
      </View>
      <View style={estilos.camera}>
        <Leitor
          onLer={(t) => {
            // A câmera dispara várias vezes por segundo: só a primeira leitura conta.
            if (lido) return;
            setLido(true);
            onLer(t);
          }}
        />
      </View>
      <View style={estilos.leitorRodape}>
        <Botao variante="secundario" rotulo="Voltar" onPress={onVoltar} />
      </View>
    </View>
  );
}

function TelaResultado({ resultado: r, agora, onProximo, onInicio }: { resultado: Resultado; agora: number; onProximo: () => void; onInicio: () => void }) {
  const { cores } = useTema();
  const fundo = r.tipo === 'valido' ? cores.success100 : r.tipo === 'repetido' ? cores.warning100 : cores.danger100;
  const cor = r.tipo === 'valido' ? cores.success700 : r.tipo === 'repetido' ? cores.warning700 : cores.danger700;
  const titulo = r.tipo === 'valido'
    ? 'Pode entrar'
    : r.tipo === 'repetido'
      ? quando(r.anterior.em, agora).startsWith('hoje') ? 'Já entrou hoje' : 'Já entrou'
      : 'Ingresso não reconhecido';
  const participante = r.tipo === 'invalido' ? null : r.participante;
  const linhas: string[] = [];
  if (r.tipo === 'repetido') linhas.push(`Primeiro check-in ${quando(r.anterior.em, agora)}, no ${r.anterior.portao}.`);
  if (r.tipo === 'invalido') linhas.push(TEXTO_INVALIDO[r.motivo], 'Peça para abrir o ingresso no app ou busque pelo nome.');
  if (r.tipo !== 'invalido' && !participante) linhas.push('Ingresso autêntico, mas o nome ainda não está na lista deste aparelho. Atualize a lista quando tiver internet.');
  const anuncio = [titulo, participante?.nome, ...linhas].filter(Boolean).join('. ');

  // Quem usa leitor de tela na equipe ouve o resultado sem procurar na tela.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(anuncio);
  }, [anuncio]);

  return (
    <Tela titulo={titulo} rodape={<Botao rotulo={r.tipo === 'invalido' ? 'Tentar de novo' : 'Ler o próximo'} onPress={onProximo} />}>
      <View style={[estilos.resultado, { backgroundColor: fundo, borderColor: cor }]}>
        <Text style={[estilos.resultadoTitulo, { color: cor }]}>{r.tipo === 'valido' ? '✓' : r.tipo === 'repetido' ? '!' : '✕'}</Text>
        {participante ? <Text style={[estilos.nome, { color: cores.ink900 }]}>{participante.nome}</Text> : null}
        {participante ? <Text style={[estilos.linha, { color: cores.ink900 }]}>{participante.tipo}</Text> : null}
        {linhas.map((l) => <Text key={l} style={[estilos.linha, { color: cores.ink900 }]}>{l}</Text>)}
      </View>
      {participante?.recursos.map((rec) => {
        const o = ORIENTACAO_RECURSO[rec];
        return o ? (
          <View key={rec} accessible style={[estilos.recurso, { backgroundColor: cores.primary050, borderColor: cores.primary600 }]}>
            <Text style={[estilos.recursoTitulo, { color: cores.primary700 }]}>{o.precisa}</Text>
            <Text style={[estilos.linha, { color: cores.ink900 }]}>{o.onde}</Text>
          </View>
        ) : null;
      })}
      <Botao variante="texto" rotulo="Voltar ao início" onPress={onInicio} />
    </Tela>
  );
}

function TelaBusca({ onEscolher, onVoltar, agora }: { onEscolher: (p: Participante) => void; onVoltar: () => void; agora: number }) {
  const { cores } = useTema();
  const { pacote } = useCredenciamento();
  const [termo, setTermo] = useState('');
  const achados = pacote ? buscarPorNome(pacote, termo) : [];
  return (
    <Tela titulo="Buscar pelo nome">
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      <TextInput
        accessibilityLabel="Nome do participante"
        placeholder="Digite pelo menos 2 letras"
        placeholderTextColor={cores.ink600}
        value={termo}
        onChangeText={setTermo}
        autoCorrect={false}
        style={[estilos.busca, { backgroundColor: cores.surface100, color: cores.ink900, borderBottomColor: cores.borderControl }]}
      />
      {termo.trim().length >= 2 ? (
        <Text accessibilityLiveRegion="polite" style={[estilos.linha, { color: cores.ink600 }]}>
          {achados.length === 0 ? 'Ninguém com esse nome na lista.' : achados.length === 1 ? '1 pessoa encontrada.' : `${achados.length} pessoas encontradas.`}
        </Text>
      ) : null}
      {achados.map((p) => (
        <Pressable
          key={p.ingressoId}
          accessibilityRole="button"
          accessibilityLabel={`${p.nome}, ${p.tipo}${p.checkin ? `, já entrou ${quando(p.checkin.em, agora)}` : ''}`}
          onPress={() => onEscolher(p)}
          style={({ pressed }) => [estilos.pessoa, { backgroundColor: cores.surface100, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[estilos.recursoTitulo, { color: cores.ink900 }]}>{p.nome}</Text>
          <Text style={[estilos.linha, { color: cores.ink600 }]}>{p.checkin ? `${p.tipo} · já entrou ${quando(p.checkin.em, agora)}` : p.tipo}</Text>
        </Pressable>
      ))}
    </Tela>
  );
}

function TelaManual({ participante: p, onConfirmar, onVoltar }: { participante: Participante; onConfirmar: () => Promise<void>; onVoltar: () => void }) {
  const [conferido, setConferido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const confirmar = async () => {
    if (!conferido) {
      setErro('Confira um documento com foto antes do check-in manual.');
      return;
    }
    setEnviando(true);
    await onConfirmar();
  };
  return (
    <Tela titulo={p.nome} rodape={<Botao rotulo="Fazer check-in manual" rotuloCarregando="Registrando…" carregando={enviando} onPress={() => void confirmar()} />}>
      <Botao variante="texto" rotulo="Voltar para a busca" onPress={onVoltar} />
      <Paragrafo>{p.tipo}</Paragrafo>
      <Paragrafo secundario>O check-in manual fica registrado com o seu nome.</Paragrafo>
      <CaixaMarcar rotulo="Conferi um documento com foto" marcado={conferido} onMudar={(v) => { setConferido(v); setErro(null); }} erro={erro} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  status: { padding: espaco['3'], borderRadius: raio.md },
  statusTexto: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  leitor: { flex: 1 },
  leitorTopo: { padding: espaco['4'], paddingTop: espaco['12'], gap: espaco['3'] },
  camera: { flex: 1, marginHorizontal: espaco['4'], borderRadius: raio.lg, overflow: 'hidden' },
  leitorRodape: { padding: espaco['4'] },
  titulo: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  resultado: { padding: espaco['6'], borderRadius: raio.lg, borderWidth: 3, gap: espaco['2'], alignItems: 'center' },
  resultadoTitulo: { fontSize: 64, lineHeight: 72, fontWeight: '700' },
  nome: { fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  linha: { fontSize: 18, lineHeight: 26, textAlign: 'center' },
  recurso: { padding: espaco['4'], borderRadius: raio.lg, borderWidth: 2, gap: espaco['1'] },
  recursoTitulo: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  busca: { minHeight: tamanho.touchLg, paddingHorizontal: espaco['3'], fontSize: 18, borderBottomWidth: 2, borderTopLeftRadius: raio.sm, borderTopRightRadius: raio.sm },
  pessoa: { padding: espaco['4'], borderRadius: raio.lg, gap: 2 },
});
