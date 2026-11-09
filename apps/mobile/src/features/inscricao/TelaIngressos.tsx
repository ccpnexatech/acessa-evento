/** Aba Ingresso: o que a pessoa comprou, disponível sem internet. O QR entra na fase 6. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { espaco, raio } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { useIngressos } from './ProvedorIngressos';
import { periodo } from './modelo';

export function TelaIngressos({ onVerEventos }: { onVerEventos: () => void }) {
  const { cores } = useTema();
  const { ingressos, carregando, offline } = useIngressos();
  if (carregando && !ingressos.length) {
    return (
      <Tela titulo="Ingresso">
        <ActivityIndicator accessibilityLabel="Carregando seus ingressos" />
      </Tela>
    );
  }
  if (!ingressos.length) {
    return (
      <Tela titulo="Ingresso">
        {offline ? <MensagemErro tom="info" texto="Sem internet. Não conseguimos conferir seus ingressos agora." /> : null}
        <Paragrafo>Você ainda não tem ingresso.</Paragrafo>
        <Botao rotulo="Ver eventos" onPress={onVerEventos} />
      </Tela>
    );
  }
  return (
    <Tela titulo={ingressos.length === 1 ? 'Ingresso' : 'Ingressos'}>
      {offline ? <MensagemErro tom="info" texto="Sem internet. Seu ingresso continua aqui." /> : null}
      {ingressos.map((i) => (
        <View key={i.id} accessible style={[estilos.cartao, { backgroundColor: cores.surface100, borderColor: cores.primary600 }]}>
          <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>{i.evento.nome}</Text>
          <Text style={[estilos.linha, { color: cores.ink900 }]}>{i.tipo}</Text>
          <Text style={[estilos.linha, { color: cores.ink600 }]}>{periodo(i.evento.inicio, i.evento.fim)}</Text>
          <Text style={[estilos.linha, { color: cores.ink600 }]}>{i.evento.local}</Text>
          <Text style={[estilos.linha, { color: cores.ink600 }]}>O QR de entrada aparece aqui na próxima versão do app.</Text>
        </View>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: { padding: espaco['4'], borderRadius: raio.lg, borderWidth: 2, gap: espaco['1'] },
  titulo: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  linha: { fontSize: 18, lineHeight: 26 },
});
