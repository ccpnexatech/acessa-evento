/**
 * Descoberta (protótipo Z1 e Z2): lista de eventos com filtro de Libras e
 * página do evento. Abertas sem login; a navegação chega por callback.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Tocavel } from '../../shared/ui/Tocavel';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { contornoCartao, useTema } from '../../shared/tema/TemaProvider';
import { useCarga } from '../../shared/hooks/useCarga';
import { Botao, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { Chip } from '../agenda/componentes';
import type { ApiInscricao } from './api';
import { NOME_RECURSO_EVENTO, periodo, reais } from './modelo';
import type { DetalheEvento, RecursoEvento, ResumoEvento } from './modelo';

function Carregando({ rotulo }: { rotulo: string }) {
  return <ActivityIndicator accessibilityLabel={rotulo} style={{ padding: espaco['6'] }} />;
}

function SelosRecursos({ recursos }: { recursos: readonly RecursoEvento[] }) {
  const { cores } = useTema();
  if (!recursos.length) return null;
  return (
    <View accessible accessibilityLabel={`Acessibilidade: ${recursos.map((r) => NOME_RECURSO_EVENTO[r]).join(', ')}`} style={estilos.selos}>
      {recursos.map((r) => (
        <Text key={r} style={[estilos.selo, { backgroundColor: cores.primary050, color: cores.primary700, borderColor: cores.borderHairline }]}>
          {NOME_RECURSO_EVENTO[r]}
        </Text>
      ))}
    </View>
  );
}

function CartaoEvento({ evento: e, onAbrir }: { evento: ResumoEvento; onAbrir: () => void }) {
  const { cores } = useTema();
  const quando = periodo(e.inicio, e.fim);
  return (
    <Tocavel
      accessibilityRole="button"
      accessibilityLabel={`${e.nome}. ${quando}, ${e.local}${e.inscricoesAbertas ? '. Inscrições abertas' : ''}`}
      accessibilityHint="Abre a página do evento"
      onPress={onAbrir}
      style={({ pressed }) => [estilos.cartao, { backgroundColor: cores.surface100, opacity: pressed ? 0.85 : 1 }, contornoCartao(cores)]}
    >
      <Text style={[estilos.titulo, { color: cores.ink900 }]}>{e.nome}</Text>
      <Text style={[estilos.meta, { color: cores.ink600 }]}>{quando}</Text>
      <Text style={[estilos.meta, { color: cores.ink600 }]}>{e.local}</Text>
      {e.inscricoesAbertas ? <Text style={[estilos.meta, { color: cores.primary700, fontWeight: '700' }]}>Inscrições abertas</Text> : null}
      <SelosRecursos recursos={e.recursosOferecidos} />
    </Tocavel>
  );
}

export function TelaEventos({ api, onAbrir }: { api: ApiInscricao; onAbrir: (slug: string) => void }) {
  const [comLibras, setComLibras] = useState(false);
  const { dados, carregando, erro, recarregar } = useCarga(() => api.eventos(comLibras ? 'libras' : undefined), [api, comLibras]);
  return (
    <Tela titulo="Eventos">
      <View accessibilityLabel="Filtros" style={estilos.filtros}>
        <Chip rotulo="Com Libras" ligado={comLibras} onMudar={setComLibras} />
      </View>
      {carregando ? <Carregando rotulo="Carregando eventos" /> : null}
      {erro ? (
        <>
          <MensagemErro texto={erro} />
          <Botao variante="secundario" rotulo="Tentar de novo" onPress={recarregar} />
        </>
      ) : null}
      {dados && !carregando && dados.length === 0 ? (
        <Paragrafo secundario>{comLibras ? 'Nenhum evento com intérprete de Libras por enquanto.' : 'Nenhum evento publicado por enquanto.'}</Paragrafo>
      ) : null}
      {!carregando && dados?.map((e) => <CartaoEvento key={e.id} evento={e} onAbrir={() => onAbrir(e.slug)} />)}
    </Tela>
  );
}

interface PropsEvento {
  readonly slug: string;
  readonly api: ApiInscricao;
  readonly jaInscrito: boolean;
  readonly onInscrever: () => void;
  readonly onVerIngresso: () => void;
  readonly onVoltar: () => void;
}

export function TelaEvento({ slug, api, jaInscrito, onInscrever, onVerIngresso, onVoltar }: PropsEvento) {
  const { dados: e, carregando, erro, recarregar } = useCarga(() => api.evento(slug), [api, slug]);
  if (!e) {
    return (
      <Tela titulo={carregando ? 'Carregando' : 'Evento indisponível'}>
        {carregando ? <Carregando rotulo="Carregando o evento" /> : null}
        <MensagemErro texto={erro} />
        {erro ? <Botao variante="secundario" rotulo="Tentar de novo" onPress={recarregar} /> : null}
        <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      </Tela>
    );
  }
  return <PaginaEvento evento={e} jaInscrito={jaInscrito} onInscrever={onInscrever} onVerIngresso={onVerIngresso} onVoltar={onVoltar} />;
}

function PaginaEvento({ evento: e, jaInscrito, onInscrever, onVerIngresso, onVoltar }: Omit<PropsEvento, 'slug' | 'api'> & { evento: DetalheEvento }) {
  const { cores } = useTema();
  const disponiveis = e.tipos.filter((t) => !t.esgotado);
  const aPartirDe = disponiveis.length ? Math.min(...disponiveis.map((t) => t.precoCentavos)) : null;
  const hora = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: e.fuso, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const acao = jaInscrito
    ? <Botao rotulo="Ver meu ingresso" onPress={onVerIngresso} />
    : e.inscricoesAbertas && disponiveis.length
      ? <Botao rotulo="Inscrever-se" onPress={onInscrever} />
      : null;
  return (
    <Tela titulo={e.nome} rodape={acao}>
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      <Paragrafo>{`${periodo(e.inicio, e.fim)}\n${e.local}`}</Paragrafo>
      {e.descricao ? <Paragrafo secundario>{e.descricao}</Paragrafo> : null}
      {jaInscrito ? <MensagemErro tom="info" texto={`Você já está no ${e.nome}.`} /> : null}
      {!jaInscrito && !e.inscricoesAbertas ? <MensagemErro tom="info" texto="As inscrições estão fechadas." /> : null}
      {!jaInscrito && e.inscricoesAbertas && !disponiveis.length ? <MensagemErro tom="info" texto="Os ingressos esgotaram." /> : null}
      {!jaInscrito && aPartirDe !== null && e.inscricoesAbertas ? <Paragrafo>{`Ingressos a partir de ${reais(aPartirDe)}`}</Paragrafo> : null}

      <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Acessibilidade oferecida</Text>
      {e.recursosOferecidos.length
        ? e.recursosOferecidos.map((r) => <Paragrafo key={r}>{`• ${NOME_RECURSO_EVENTO[r]}`}</Paragrafo>)
        : <Paragrafo secundario>A organização ainda não informou.</Paragrafo>}

      {e.destaques.length ? (
        <>
          <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Programação</Text>
          {e.destaques.map((d) => (
            <View key={`${d.inicio}${d.titulo}`} accessible style={[estilos.destaque, { borderLeftColor: cores.primary600 }]}>
              <Text style={[estilos.meta, { color: cores.ink600 }]}>{hora(d.inicio)}</Text>
              <Text style={[estilos.meta, { color: cores.ink900, fontWeight: '700' }]}>{d.titulo}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco['2'] },
  cartao: { borderRadius: raio.lg, padding: espaco['4'], gap: espaco['1'], minHeight: tamanho.touchLg },
  titulo: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  secao: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  meta: { fontSize: 16, lineHeight: 24 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco['2'], marginTop: espaco['1'] },
  selo: { fontSize: 14, lineHeight: 20, fontWeight: '700', paddingHorizontal: espaco['2'], paddingVertical: 2, borderRadius: raio.sm, borderWidth: 1, overflow: 'hidden' },
  destaque: { borderLeftWidth: 4, paddingLeft: espaco['3'], gap: 2 },
});
