/**
 * Peças da agenda, seguindo o design system: aviso de conexão, abas de dia,
 * chips de filtro, selos de acessibilidade e cartão da atividade.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { NOME_RECURSO, hora } from './modelo';
import type { Atividade, Dia, Recurso } from './modelo';
import type { Conexao } from './ProvedorAgenda';

export function AvisoConexao({ conexao, pendentes, salvaHaTempo }: { conexao: Conexao; pendentes: number; salvaHaTempo: boolean }) {
  const { cores } = useTema();
  const texto = conexao === 'online' ? null : conexao === 'sincronizando'
    ? 'Atualizando a agenda.'
    : pendentes
      ? `Sem internet. ${pendentes === 1 ? '1 favorito será enviado' : `${pendentes} favoritos serão enviados`} quando a conexão voltar.`
      : salvaHaTempo
        ? 'Sem internet. Você está vendo a última agenda salva.'
        : 'Sem internet. Seu ingresso e a agenda continuam disponíveis.';
  // O Android anuncia sozinho pela região viva; o iOS precisa do anúncio explícito.
  // "Atualizando" não é anunciado, para não falar a cada sincronização.
  useEffect(() => {
    if (texto && conexao === 'offline' && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(texto);
  }, [texto, conexao]);
  if (!texto) return null;
  const fundo = conexao === 'sincronizando' ? cores.primary050 : cores.warning100;
  const cor = conexao === 'sincronizando' ? cores.primary700 : cores.warning700;
  return (
    <View accessibilityRole="text" accessibilityLiveRegion="polite" style={[estilos.aviso, { backgroundColor: fundo }]}>
      <Text style={[estilos.avisoTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

export function AbasDias({ dias, ativo, onMudar }: { dias: readonly Dia[]; ativo: string | null; onMudar: (id: string) => void }) {
  const { cores } = useTema();
  return (
    <View accessibilityRole="tablist" style={estilos.abas}>
      {dias.map((d) => {
        const on = d.id === ativo;
        return (
          <Pressable
            key={d.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={d.extenso}
            onPress={() => onMudar(d.id)}
            style={[estilos.aba, { backgroundColor: on ? cores.primary600 : cores.surface100 }]}
          >
            <Text style={[estilos.abaSemana, { color: on ? cores.onPrimary : cores.ink600 }]}>{d.semana}</Text>
            <Text style={[estilos.abaData, { color: on ? cores.onPrimary : cores.ink900 }]}>{d.data}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ rotulo, ligado, onMudar }: { rotulo: string; ligado: boolean; onMudar: (v: boolean) => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: ligado }}
      onPress={() => onMudar(!ligado)}
      style={[estilos.chip, { backgroundColor: ligado ? cores.primary100 : cores.surface100, borderColor: ligado ? cores.primary600 : cores.borderControl }]}
    >
      <Text style={[estilos.chipTexto, { color: ligado ? cores.primary700 : cores.ink900 }]}>{ligado ? `✓ ${rotulo}` : rotulo}</Text>
    </Pressable>
  );
}

export function Selos({ recursos }: { recursos: readonly Recurso[] }) {
  const { cores } = useTema();
  if (!recursos.length) return null;
  return (
    <View accessible accessibilityLabel={`Recursos: ${recursos.map((r) => NOME_RECURSO[r]).join(', ')}`} style={estilos.selos}>
      {recursos.map((r) => (
        <Text key={r} style={[estilos.selo, { backgroundColor: cores.primary050, color: cores.primary700, borderColor: cores.borderHairline }]}>
          {NOME_RECURSO[r]}
        </Text>
      ))}
    </View>
  );
}

export function BotaoFavorito({ titulo, ligado, onPress }: { titulo: string; ligado: boolean; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={`Favoritar ${titulo}`}
      accessibilityState={{ checked: ligado }}
      hitSlop={8}
      onPress={onPress}
      style={estilos.fav}
    >
      <Text style={{ fontSize: 26, color: ligado ? cores.accent400 : cores.ink600 }}>{ligado ? '★' : '☆'}</Text>
    </Pressable>
  );
}

interface PropsCartao {
  readonly atividade: Atividade;
  readonly fuso: string;
  readonly agora: boolean;
  readonly favorita: boolean;
  readonly onAbrir: () => void;
  readonly onFavoritar: () => void;
}

export function CartaoAtividade({ atividade: a, fuso, agora, favorita, onAbrir, onFavoritar }: PropsCartao) {
  const { cores } = useTema();
  const horario = `${hora(a.inicio, fuso)} às ${hora(a.fim, fuso)}`;
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.surface100, borderColor: agora ? cores.primary600 : 'transparent' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${a.titulo}. ${horario}${a.sala ? `, ${a.sala.nome}` : ''}${agora ? '. Acontecendo agora' : ''}`}
        accessibilityHint="Abre os detalhes"
        onPress={onAbrir}
        style={({ pressed }) => [estilos.cartaoCorpo, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={estilos.linha}>
          <Text style={[estilos.horario, { color: cores.ink600 }]}>{horario}</Text>
          {agora ? <Text style={[estilos.agora, { backgroundColor: cores.accent400, color: cores.onAccent }]}>Agora</Text> : null}
        </View>
        <Text style={[estilos.titulo, { color: cores.ink900 }]}>{a.titulo}</Text>
        {a.sala ? <Text style={[estilos.meta, { color: cores.ink600 }]}>{`${a.sala.nome} · ${a.sala.local}`}</Text> : null}
        {a.palestrantes.length ? <Text style={[estilos.meta, { color: cores.ink600 }]}>{a.palestrantes.map((p) => p.nome).join(', ')}</Text> : null}
        <Selos recursos={a.recursos} />
      </Pressable>
      <BotaoFavorito titulo={a.titulo} ligado={favorita} onPress={onFavoritar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { padding: espaco['3'], borderRadius: raio.md },
  avisoTexto: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  abas: { flexDirection: 'row', gap: espaco['2'] },
  aba: { flex: 1, minHeight: tamanho.touchLg, borderRadius: raio.md, alignItems: 'center', justifyContent: 'center', paddingVertical: espaco['2'] },
  abaSemana: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  abaData: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  chip: { minHeight: tamanho.touchMin, paddingHorizontal: espaco['4'], borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  chipTexto: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco['2'], marginTop: espaco['1'] },
  selo: { fontSize: 14, lineHeight: 20, fontWeight: '700', paddingHorizontal: espaco['2'], paddingVertical: 2, borderRadius: raio.sm, borderWidth: 1, overflow: 'hidden' },
  fav: { width: tamanho.touchMin, height: tamanho.touchMin, alignItems: 'center', justifyContent: 'center' },
  cartao: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: raio.lg, borderWidth: 2, paddingLeft: espaco['4'], paddingVertical: espaco['3'], paddingRight: espaco['1'] },
  cartaoCorpo: { flex: 1, gap: espaco['1'] },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco['2'] },
  horario: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  agora: { fontSize: 14, lineHeight: 20, fontWeight: '700', paddingHorizontal: espaco['2'], borderRadius: raio.sm, overflow: 'hidden' },
  titulo: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  meta: { fontSize: 16, lineHeight: 24 },
});
