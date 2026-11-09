/** Ingresso no topo da Agenda com "Mostrar QR" (feature 03, "Valor em 3 segundos"). */
import { StyleSheet, Text, View } from 'react-native';
import { espaco, raio } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao } from '../../shared/ui/componentes';
import type { Ingresso } from './modelo';

export function AtalhoIngresso({ ingresso, onMostrar }: { ingresso: Ingresso; onMostrar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.primary050, borderColor: cores.primary600 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[estilos.titulo, { color: cores.ink900 }]}>{`Seu ingresso · ${ingresso.tipo}`}</Text>
        <Text style={[estilos.texto, { color: cores.ink600 }]}>{ingresso.checkin ? 'Check-in feito' : 'Funciona sem internet'}</Text>
      </View>
      <Botao rotulo="Mostrar QR" onPress={onMostrar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco['3'], padding: espaco['4'], borderRadius: raio.lg, borderWidth: 2 },
  titulo: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  texto: { fontSize: 16, lineHeight: 24 },
});
