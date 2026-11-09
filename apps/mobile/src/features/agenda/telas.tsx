/**
 * Telas da agenda e do detalhe. Recebem a navegação por callback,
 * para serem testadas sem o roteador.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao, MensagemErro } from '../../shared/ui/componentes';
import { useAgenda } from './ProvedorAgenda';
import { AbasDias, AvisoConexao, BotaoFavorito, CartaoAtividade, Chip, Selos } from './componentes';
import { NOME_RECURSO, diaInicial, diaLocal, dias as calcularDias, filtrar, hora, secoes } from './modelo';
import type { Recurso } from './modelo';

const RECURSOS: readonly Recurso[] = ['libras', 'legenda', 'audiodescricao'];

interface PropsAgenda {
  readonly onAbrir: (atividadeId: string) => void;
  readonly agora?: () => Date;
  /** Conteúdo acima dos filtros, como o atalho do ingresso. */
  readonly topo?: ReactNode;
}

export function TelaAgenda({ onAbrir, agora = () => new Date(), topo }: PropsAgenda) {
  const { cores } = useTema();
  const { agenda, carregando, conexao, erro, favoritas, pendentes, alternarFavorita, atualizar } = useAgenda();
  const fuso = agenda?.evento.fuso ?? 'America/Fortaleza';
  const listaDias = useMemo(() => calcularDias(agenda?.atividades ?? [], fuso), [agenda, fuso]);
  const [dia, setDia] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [soFavoritas, setSoFavoritas] = useState(false);
  const diaAtivo = dia ?? diaInicial(listaDias, agora(), fuso);

  const visiveis = useMemo(() => {
    const doDia = (agenda?.atividades ?? []).filter((a) => diaLocal(a.inicio, fuso) === diaAtivo);
    return secoes(filtrar(doDia, { busca, recursos, soFavoritas }, favoritas), agora());
  }, [agenda, fuso, diaAtivo, busca, recursos, soFavoritas, favoritas, agora]);

  if (carregando && !agenda) {
    return (
      <View style={[estilos.centro, { backgroundColor: cores.surface000 }]}>
        <ActivityIndicator accessibilityLabel="Carregando a agenda" />
      </View>
    );
  }

  if (!agenda) {
    return (
      <View style={[estilos.centro, { backgroundColor: cores.surface000, padding: espaco['4'] }]}>
        <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>Agenda indisponível</Text>
        <Text style={[estilos.texto, { color: cores.ink600 }]}>
          {erro ?? 'Precisamos de internet uma vez para baixar a agenda. Depois ela funciona sem conexão.'}
        </Text>
        <Botao rotulo="Tentar de novo" onPress={() => void atualizar()} />
      </View>
    );
  }

  const alternarRecurso = (r: Recurso) => setRecursos((atual) => (atual.includes(r) ? atual.filter((x) => x !== r) : [...atual, r]));
  const nenhum = visiveis.length === 0;

  return (
    <ScrollView style={{ backgroundColor: cores.surface000 }} contentContainerStyle={estilos.conteudo}>
      <Text style={[estilos.sub, { color: cores.primary600 }]}>{agenda.evento.nome}</Text>
      <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>Agenda</Text>
      {topo}
      <AvisoConexao conexao={conexao} pendentes={pendentes} salvaHaTempo={conexao === 'offline'} />
      <MensagemErro texto={erro} />
      <AbasDias dias={listaDias} ativo={diaAtivo} onMudar={setDia} />
      <TextInput
        accessibilityLabel="Buscar palestra ou palestrante"
        placeholder="Buscar palestra ou palestrante"
        placeholderTextColor={cores.ink600}
        value={busca}
        onChangeText={setBusca}
        style={[estilos.busca, { backgroundColor: cores.surface100, color: cores.ink900, borderBottomColor: cores.borderControl }]}
      />
      <View accessibilityLabel="Filtros" style={estilos.filtros}>
        <Chip rotulo="Favoritas" ligado={soFavoritas} onMudar={setSoFavoritas} />
        {RECURSOS.map((r) => <Chip key={r} rotulo={NOME_RECURSO[r]} ligado={recursos.includes(r)} onMudar={() => alternarRecurso(r)} />)}
      </View>

      {nenhum ? (
        <View style={estilos.vazio}>
          <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Nenhuma sessão encontrada</Text>
          <Text style={[estilos.texto, { color: cores.ink600 }]}>Tente outro dia ou tire algum filtro.</Text>
          {busca || recursos.length || soFavoritas ? (
            <Botao variante="texto" rotulo="Limpar busca e filtros" onPress={() => { setBusca(''); setRecursos([]); setSoFavoritas(false); }} />
          ) : null}
        </View>
      ) : (
        visiveis.map((s) => (
          <View key={s.titulo} style={estilos.grupo}>
            <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>
              {`${s.titulo} · ${s.atividades.length === 1 ? '1 sessão' : `${s.atividades.length} sessões`}`}
            </Text>
            {s.atividades.map((a) => (
              <CartaoAtividade
                key={a.id}
                atividade={a}
                fuso={fuso}
                agora={s.titulo === 'Agora'}
                favorita={favoritas.has(a.id)}
                onAbrir={() => onAbrir(a.id)}
                onFavoritar={() => void alternarFavorita(a.id)}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

export function TelaDetalhe({ atividadeId, onVoltar }: { atividadeId: string; onVoltar: () => void }) {
  const { cores } = useTema();
  const { agenda, favoritas, alternarFavorita } = useAgenda();
  const a = agenda?.atividades.find((x) => x.id === atividadeId);
  const fuso = agenda?.evento.fuso ?? 'America/Fortaleza';

  if (!a) {
    return (
      <View style={[estilos.centro, { backgroundColor: cores.surface000, padding: espaco['4'] }]}>
        <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>Palestra não encontrada</Text>
        <Text style={[estilos.texto, { color: cores.ink600 }]}>Ela pode ter saído da agenda.</Text>
        <Botao rotulo="Voltar para a agenda" onPress={onVoltar} />
      </View>
    );
  }

  const favorita = favoritas.has(a.id);
  const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a.inicio));
  return (
    <View style={{ flex: 1, backgroundColor: cores.surface000 }}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Botao variante="texto" rotulo="Voltar para a agenda" onPress={onVoltar} />
        <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>{a.titulo}</Text>
        <Selos recursos={a.recursos} />
        <Info rotulo="Quando" valor={`${quando}, ${hora(a.inicio, fuso)} às ${hora(a.fim, fuso)}`} />
        {a.sala ? <Info rotulo="Onde" valor={`${a.sala.nome} · ${a.sala.local}`} detalhe={a.sala.acessibilidade} /> : null}
        {a.palestrantes.length ? (
          <View style={estilos.grupo}>
            <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Quem fala</Text>
            {a.palestrantes.map((p) => (
              <Text key={p.nome} style={[estilos.texto, { color: cores.ink900 }]}>
                {p.nome}
                {p.cargo ? <Text style={{ color: cores.ink600 }}>{`\n${p.cargo}`}</Text> : null}
              </Text>
            ))}
          </View>
        ) : null}
        {a.resumo ? (
          <View style={estilos.grupo}>
            <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Sobre</Text>
            <Text style={[estilos.texto, { color: cores.ink900 }]}>{a.resumo}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={[estilos.rodape, { borderTopColor: cores.borderHairline }]}>
        <BotaoFavorito titulo={a.titulo} ligado={favorita} onPress={() => void alternarFavorita(a.id)} />
        <Text style={[estilos.texto, { color: cores.ink900, flex: 1 }]}>{favorita ? 'Nas suas favoritas' : 'Toque na estrela para salvar nas favoritas'}</Text>
      </View>
    </View>
  );
}

function Info({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string | null }) {
  const { cores } = useTema();
  return (
    <View accessible style={[estilos.info, { backgroundColor: cores.surface100 }]}>
      <Text style={[estilos.infoRotulo, { color: cores.ink600 }]}>{rotulo}</Text>
      <Text style={[estilos.texto, { color: cores.ink900 }]}>{valor}</Text>
      {detalhe ? <Text style={[estilos.texto, { color: cores.ink600 }]}>{detalhe}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', gap: espaco['3'] },
  conteudo: { padding: espaco['4'], paddingTop: espaco['12'], gap: espaco['4'] },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  titulo: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  secao: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  texto: { fontSize: 18, lineHeight: 28 },
  busca: { minHeight: tamanho.touchLg, paddingHorizontal: espaco['3'], fontSize: 18, borderBottomWidth: 2, borderTopLeftRadius: raio.sm, borderTopRightRadius: raio.sm },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco['2'] },
  grupo: { gap: espaco['3'] },
  vazio: { gap: espaco['2'], paddingVertical: espaco['6'] },
  info: { padding: espaco['4'], borderRadius: raio.lg, gap: espaco['1'] },
  infoRotulo: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: espaco['2'], padding: espaco['4'], borderTopWidth: StyleSheet.hairlineWidth },
});
