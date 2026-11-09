/** Brilho máximo enquanto o QR está na tela (expo-brightness), devolvendo o anterior ao sair. */
import * as Brightness from 'expo-brightness';

export function aumentarBrilho(): () => void {
  let anterior: number | null = null;
  let ativo = true;
  void (async () => {
    try {
      anterior = await Brightness.getBrightnessAsync();
      if (ativo) await Brightness.setBrightnessAsync(1);
    } catch {
      // Sem permissão ou sem suporte: o QR continua legível, só não fica mais claro.
    }
  })();
  return () => {
    ativo = false;
    if (anterior !== null) void Brightness.setBrightnessAsync(anterior).catch(() => undefined);
  };
}
