/**
 * Componentes base do design system em React Native, ligados aos tokens.
 * Mesmas regras das prévias web: alvo de 48 pt, rótulo sempre visível,
 * erro em texto ligado ao campo e anunciado pelo leitor de tela.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../tema/TemaProvider';

export function Tela({ titulo, rodape, children }: { titulo: string; rodape?: ReactNode; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <KeyboardAvoidingView style={[estilos.tela, { backgroundColor: cores.surface000 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>{titulo}</Text>
        {children}
      </ScrollView>
      {rodape ? <View style={[estilos.rodape, { borderTopColor: cores.borderHairline, backgroundColor: cores.surface000 }]}>{rodape}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function Paragrafo({ children, secundario = false }: { children: ReactNode; secundario?: boolean }) {
  const { cores } = useTema();
  return <Text style={[estilos.paragrafo, { color: secundario ? cores.ink600 : cores.ink900 }]}>{children}</Text>;
}

interface PropsBotao {
  readonly rotulo: string;
  readonly onPress: () => void;
  readonly variante?: 'primario' | 'secundario' | 'texto';
  readonly carregando?: boolean;
  readonly rotuloCarregando?: string;
  readonly desabilitado?: boolean;
}

export function Botao({ rotulo, onPress, variante = 'primario', carregando = false, rotuloCarregando, desabilitado = false }: PropsBotao) {
  const { cores } = useTema();
  const inativo = desabilitado || carregando;
  const fundo = variante === 'primario' ? cores.primary600 : variante === 'secundario' ? cores.primary100 : 'transparent';
  const texto = variante === 'primario' ? cores.onPrimary : variante === 'secundario' ? cores.primary700 : cores.primary600;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        variante !== 'texto' && estilos.botaoCheio,
        { backgroundColor: inativo && variante !== 'texto' ? cores.surface200 : fundo, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {carregando ? <ActivityIndicator color={texto} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      <Text style={[estilos.botaoTexto, { color: inativo && variante !== 'texto' ? cores.ink600 : texto }]}>
        {carregando ? (rotuloCarregando ?? rotulo) : rotulo}
      </Text>
    </Pressable>
  );
}

export function MensagemErro({ texto, nativeID, tom = 'erro' }: { texto: string | null; nativeID?: string; tom?: 'erro' | 'info' }) {
  const { cores } = useTema();
  useEffect(() => {
    if (texto) AccessibilityInfo.announceForAccessibility(texto);
  }, [texto]);
  if (!texto) return null;
  return (
    <Text
      nativeID={nativeID}
      accessibilityRole={tom === 'erro' ? 'alert' : 'text'}
      accessibilityLiveRegion={tom === 'erro' ? 'assertive' : 'polite'}
      style={[estilos.erro, { color: tom === 'erro' ? cores.danger700 : cores.success700 }]}
    >
      {texto}
    </Text>
  );
}

interface PropsCampo extends Omit<TextInputProps, 'style'> {
  readonly rotulo: string;
  readonly dica?: string;
  readonly erro?: string | null;
  readonly grande?: boolean;
}

export function CampoTexto({ rotulo, dica, erro, grande = false, ...resto }: PropsCampo) {
  const { cores } = useTema();
  const descricao = [dica, erro].filter(Boolean).join('. ');
  return (
    <View style={estilos.campo}>
      <Text style={[estilos.rotulo, { color: cores.ink900 }]}>{rotulo}</Text>
      {dica ? <Text style={[estilos.dica, { color: cores.ink600 }]}>{dica}</Text> : null}
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityHint={descricao || undefined}
        placeholderTextColor={cores.ink600}
        style={[
          estilos.entrada,
          grande && estilos.entradaGrande,
          { color: cores.ink900, backgroundColor: cores.surface100, borderBottomColor: erro ? cores.danger700 : cores.borderControl },
        ]}
        {...resto}
      />
      <MensagemErro texto={erro ?? null} />
    </View>
  );
}

export function CaixaMarcar({ rotulo, dica, marcado, onMudar, erro }: { rotulo: string; dica?: string; marcado: boolean; onMudar: (v: boolean) => void; erro?: string | null }) {
  const { cores } = useTema();
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcado }}
        accessibilityLabel={rotulo}
        {...(dica ? { accessibilityHint: dica } : {})}
        onPress={() => onMudar(!marcado)}
        style={estilos.marcar}
      >
        <View
          style={[
            estilos.caixa,
            { borderColor: erro ? cores.danger700 : marcado ? cores.primary600 : cores.borderControl, backgroundColor: marcado ? cores.primary600 : cores.surface000 },
          ]}
        >
          {marcado ? <Text style={{ color: cores.onPrimary, fontWeight: '700' }}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[estilos.paragrafo, { color: cores.ink900 }]}>{rotulo}</Text>
          {dica ? <Text style={[estilos.dicaOpcao, { color: cores.ink600 }]}>{dica}</Text> : null}
        </View>
      </Pressable>
      <MensagemErro texto={erro ?? null} />
    </View>
  );
}

interface PropsOpcao {
  readonly rotulo: string;
  readonly dica?: string | null;
  /** Texto à direita, como o preço. */
  readonly valor?: string;
  readonly marcado: boolean;
  readonly desabilitado?: boolean;
  /** Motivo de estar desabilitado, dito em voz e escrito na tela ("Esgotado"). */
  readonly motivo?: string;
  readonly onPress: () => void;
}

/** Uma opção de escolha única (role radio). Desabilitada aparece riscada e com o motivo escrito. */
export function OpcaoRadio({ rotulo, dica, valor, marcado, desabilitado = false, motivo, onPress }: PropsOpcao) {
  const { cores } = useTema();
  const cor = desabilitado ? cores.ink600 : cores.ink900;
  const nome = [rotulo, valor, desabilitado && motivo ? motivo : null].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: marcado, disabled: desabilitado }}
      accessibilityLabel={nome}
      {...(dica ? { accessibilityHint: dica } : {})}
      disabled={desabilitado}
      onPress={onPress}
      style={[
        estilos.opcao,
        {
          borderColor: marcado ? cores.primary600 : cores.borderControl,
          backgroundColor: desabilitado ? cores.surface200 : marcado ? cores.primary050 : cores.surface000,
        },
      ]}
    >
      <View style={[estilos.bolinha, { borderColor: marcado ? cores.primary600 : cores.borderControl }]}>
        {marcado ? <View style={[estilos.miolo, { backgroundColor: cores.primary600 }]} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[estilos.opcaoRotulo, { color: cor, textDecorationLine: desabilitado ? 'line-through' : 'none' }]}>{rotulo}</Text>
        {dica ? <Text style={[estilos.dicaOpcao, { color: cores.ink600 }]}>{dica}</Text> : null}
        {desabilitado && motivo ? <Text style={[estilos.opcaoRotulo, { color: cores.ink900 }]}>{motivo}</Text> : null}
      </View>
      {valor ? <Text style={[estilos.opcaoRotulo, { color: cor, textDecorationLine: desabilitado ? 'line-through' : 'none' }]}>{valor}</Text> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco['3'], minHeight: tamanho.touchLg, padding: espaco['3'], borderWidth: 2, borderRadius: raio.md },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  miolo: { width: 12, height: 12, borderRadius: 6 },
  opcaoRotulo: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  dicaOpcao: { fontSize: 16, lineHeight: 24 },
  tela: { flex: 1 },
  conteudo: { padding: espaco['4'], paddingTop: espaco['12'], gap: espaco['4'] },
  titulo: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
  paragrafo: { fontSize: 18, lineHeight: 28 },
  rodape: { padding: espaco['4'], gap: espaco['2'], borderTopWidth: StyleSheet.hairlineWidth },
  botao: { minHeight: tamanho.touchMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco['2'], paddingHorizontal: espaco['4'] },
  botaoCheio: { minHeight: tamanho.touchLg, borderRadius: raio.md },
  botaoTexto: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  campo: { gap: espaco['1'] },
  rotulo: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  dica: { fontSize: 14, lineHeight: 20 },
  entrada: { minHeight: tamanho.touchLg, paddingHorizontal: espaco['3'], fontSize: 18, borderTopLeftRadius: raio.sm, borderTopRightRadius: raio.sm, borderBottomWidth: 2 },
  entradaGrande: { fontSize: 28, letterSpacing: 8, textAlign: 'center' },
  erro: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  marcar: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco['3'], minHeight: tamanho.touchMin, paddingVertical: espaco['2'] },
  caixa: { width: 28, height: 28, borderWidth: 2, borderRadius: raio.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
