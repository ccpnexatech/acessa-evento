/**
 * Adaptadores nativos do credenciamento: câmera (expo-camera) e vibração
 * (expo-haptics). As telas recebem só as portas, então os testes não precisam deles.
 */
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { espaco } from '@acessa-evento/tokens';
import { Botao, Paragrafo } from '../../shared/ui/componentes';
import type { PropsLeitor } from './FluxoCredenciamento';
import type { Resultado } from './modelo';

export function LeitorCamera({ onLer }: PropsLeitor) {
  const [permissao, pedir] = useCameraPermissions();
  if (!permissao) return null;
  if (!permissao.granted) {
    return (
      <View style={estilos.pedido}>
        <Paragrafo>Para ler o QR dos ingressos, o app precisa da câmera.</Paragrafo>
        {permissao.canAskAgain
          ? <Botao rotulo="Permitir câmera" onPress={() => void pedir()} />
          : <Paragrafo secundario>A câmera está bloqueada nos ajustes do aparelho. Enquanto isso, use a busca pelo nome.</Paragrafo>}
      </View>
    );
  }
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={({ data }) => onLer(data)}
      accessibilityLabel="Câmera lendo QR"
    />
  );
}

/** Curta para "pode entrar", dupla para "já entrou", erro para "não reconhecido". */
export function vibrar(tipo: Resultado['tipo']): void {
  const t = tipo === 'valido'
    ? Haptics.NotificationFeedbackType.Success
    : tipo === 'repetido'
      ? Haptics.NotificationFeedbackType.Warning
      : Haptics.NotificationFeedbackType.Error;
  void Haptics.notificationAsync(t).catch(() => undefined);
}

const estilos = StyleSheet.create({
  pedido: { flex: 1, justifyContent: 'center', gap: espaco['3'], padding: espaco['4'] },
});
