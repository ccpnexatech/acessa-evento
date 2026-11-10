/**
 * Assistente do evento (feature 05): uma pergunta por tela, opções como
 * botões, resposta revisada pela organização e "Isso respondeu sua dúvida?".
 * Funciona sem internet depois da primeira abertura.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import { Botao, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { dataRevisao, linkCanal, progresso } from './modelo';
import type { Assistente, Canal } from './modelo';
import type { AssistenteOffline } from './sincronizacao';

interface Props {
  readonly servico: Pick<AssistenteOffline, 'salvo' | 'sincronizar' | 'avaliar' | 'enviarPendentes'>;
  readonly abrirLink: (url: string) => void;
  readonly onFechar: () => void;
}

/** Cada passo guarda o nó e, ao avançar, a opção escolhida (para voltar com ela marcada). */
interface Passo { readonly id: string; readonly escolha?: number }
type Fim = null | 'sim' | 'nao' | 'canais';

export function TelaAssistente({ servico, abrirLink, onFechar }: Props) {
  const [assistente, setAssistente] = useState<Assistente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [caminho, setCaminho] = useState<Passo[]>([]);
  const [fim, setFim] = useState<Fim>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const salvo = await servico.salvo();
      if (vivo && salvo) {
        setAssistente(salvo);
        setCaminho([{ id: salvo.grafo.inicio }]);
        setCarregando(false);
      }
      try {
        const novo = await servico.sincronizar();
        if (!vivo) return;
        // Versão nova enquanto a pessoa não começou: troca. No meio do caminho, mantém a que ela está usando.
        setAssistente((atual) => (atual && atual.versao === novo.versao ? atual : novo));
        setCaminho((c) => (c.length > 1 ? c : [{ id: novo.grafo.inicio }]));
        void servico.enviarPendentes();
      } catch (e) {
        if (vivo && !salvo) {
          setErro(e instanceof ErroApi && e.status === 0
            ? 'Precisamos de internet uma vez para baixar o assistente. Depois ele funciona sem conexão.'
            : e instanceof Error ? e.message : 'Não foi possível abrir o assistente.');
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [servico]);

  const atual = caminho.at(-1);
  const no = assistente && atual ? assistente.grafo.nos[atual.id] : undefined;

  // O leitor de tela ouve a posição e a pergunta antes das opções (feature 05).
  const anuncio = no?.tipo === 'pergunta' && assistente && atual
    ? (() => {
        const p = progresso(assistente.grafo, atual.id, caminho.length - 1);
        return `Pergunta ${p.atual} de ${p.total}. ${no.texto}`;
      })()
    : no?.tipo === 'resposta' && !fim ? `${no.titulo}. ${no.texto}` : null;
  useEffect(() => {
    if (anuncio && caminho.length > 1) AccessibilityInfo.announceForAccessibility(anuncio);
  }, [anuncio, caminho.length]);

  if (!assistente || !no || !atual) {
    return (
      <Tela titulo="Assistente do evento">
        {carregando ? <ActivityIndicator accessibilityLabel="Carregando o assistente" /> : null}
        <MensagemErro texto={erro} />
        <Botao variante="texto" rotulo="Voltar" onPress={onFechar} />
      </Tela>
    );
  }

  const escolher = (indice: number, destino: string) => {
    setFim(null);
    setCaminho((c) => [...c.slice(0, -1), { id: atual.id, escolha: indice }, { id: destino }]);
  };
  const voltar = () => {
    setFim(null);
    setCaminho((c) => (c.length > 1 ? c.slice(0, -1) : c));
  };
  const recomecar = () => {
    setFim(null);
    setCaminho([{ id: assistente.grafo.inicio }]);
  };
  const avaliar = (util: boolean) => {
    setFim(util ? 'sim' : 'nao');
    void servico.avaliar({ versao: assistente.versao, respostaId: atual.id, util });
  };

  if (fim === 'canais') {
    return <TelaCanais canais={assistente.canais} abrirLink={abrirLink} onVoltar={() => setFim(null)} />;
  }

  if (no.tipo === 'pergunta') {
    const p = progresso(assistente.grafo, atual.id, caminho.length - 1);
    return (
      <Tela titulo="Assistente do evento">
        <PerguntaAtual rotulo={`Pergunta ${p.atual} de ${p.total}`} texto={no.texto} />
        <View style={estilos.opcoes}>
          {no.opcoes.map((o, i) => <BotaoOpcao key={`${atual.id}-${i}`} rotulo={o.rotulo} selecionada={atual.escolha === i} onPress={() => escolher(i, o.destino)} />)}
        </View>
        {caminho.length > 1 ? <Botao variante="secundario" rotulo="Voltar" onPress={voltar} /> : null}
        <Botao variante="texto" rotulo="Não encontrei. Falar com a organização" onPress={() => setFim('canais')} />
        <Botao variante="texto" rotulo="Fechar o assistente" onPress={onFechar} />
      </Tela>
    );
  }

  return (
    <Tela titulo={no.titulo}>
      <Paragrafo>{no.texto}</Paragrafo>
      <Paragrafo secundario>{`Revisada pela organização em ${dataRevisao(no.revisadaEm)}.`}</Paragrafo>
      {fim === null ? (
        <View style={estilos.avaliacao}>
          <PerguntaAtual texto="Isso respondeu sua dúvida?" />
          <View style={estilos.simNao}>
            <View style={{ flex: 1 }}><Botao rotulo="Sim" onPress={() => avaliar(true)} /></View>
            <View style={{ flex: 1 }}><Botao variante="secundario" rotulo="Não" onPress={() => avaliar(false)} /></View>
          </View>
        </View>
      ) : null}
      {fim === 'sim' ? <MensagemErro tom="info" texto="Que bom! Obrigado por avisar." /> : null}
      {fim === 'nao' ? (
        <>
          <MensagemErro tom="info" texto="Obrigado por avisar. A organização vê quais respostas não ajudaram, sem saber quem respondeu." />
          <Botao rotulo="Falar com a organização" onPress={() => setFim('canais')} />
        </>
      ) : null}
      <Botao variante="secundario" rotulo="Voltar" onPress={voltar} />
      <Botao variante="texto" rotulo="Fazer outra pergunta" onPress={recomecar} />
    </Tela>
  );
}

function PerguntaAtual({ rotulo, texto }: { rotulo?: string; texto: string }) {
  const { cores } = useTema();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={rotulo ? `${rotulo}. ${texto}` : texto} style={estilos.pergunta}>
      {rotulo ? <Text style={[estilos.progresso, { color: cores.primary700 }]}>{rotulo}</Text> : null}
      <Text style={[estilos.textoPergunta, { color: cores.ink900 }]}>{texto}</Text>
    </View>
  );
}

function BotaoOpcao({ rotulo, selecionada, onPress }: { rotulo: string; selecionada: boolean; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: selecionada }}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.opcao,
        { borderColor: selecionada ? cores.primary600 : cores.borderControl, backgroundColor: selecionada ? cores.primary050 : cores.surface000, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[estilos.rotuloOpcao, { color: cores.ink900 }]}>{selecionada ? `✓ ${rotulo}` : rotulo}</Text>
      <Text style={[estilos.rotuloOpcao, { color: cores.ink600 }]}>›</Text>
    </Pressable>
  );
}

const ACAO_CANAL: Readonly<Record<Canal['tipo'], string>> = { email: 'Enviar e-mail', telefone: 'Ligar', whatsapp: 'Abrir o WhatsApp', balcao: '' };

function TelaCanais({ canais, abrirLink, onVoltar }: { canais: readonly Canal[]; abrirLink: (url: string) => void; onVoltar: () => void }) {
  const { cores } = useTema();
  return (
    <Tela titulo="Falar com a organização">
      {canais.map((c) => {
        const link = linkCanal(c);
        return (
          <View key={`${c.tipo}-${c.valor}`} style={[estilos.canal, { backgroundColor: cores.surface100 }]}>
            <Text style={[estilos.rotuloOpcao, { color: cores.ink900 }]}>{c.rotulo}</Text>
            <Text style={[estilos.valorCanal, { color: cores.ink600 }]}>{c.valor}</Text>
            {link ? <Botao variante="secundario" rotulo={`${ACAO_CANAL[c.tipo]}: ${c.rotulo}`} onPress={() => abrirLink(link)} /> : null}
          </View>
        );
      })}
      <Botao variante="texto" rotulo="Voltar ao assistente" onPress={onVoltar} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  pergunta: { gap: espaco['1'] },
  progresso: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  textoPergunta: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  opcoes: { gap: espaco['2'] },
  opcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco['2'], minHeight: tamanho.touchLg, padding: espaco['4'], borderWidth: 2, borderRadius: raio.md },
  rotuloOpcao: { fontSize: 18, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  avaliacao: { gap: espaco['3'] },
  simNao: { flexDirection: 'row', gap: espaco['3'] },
  canal: { padding: espaco['4'], borderRadius: raio.lg, gap: espaco['2'] },
  valorCanal: { fontSize: 18, lineHeight: 26 },
});
