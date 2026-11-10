/**
 * Pressable com anel de foco de 3 pt (feature 06, "Navegação por teclado e switch").
 * O anel usa outline, que não mexe no layout, na cor focusRing do tema.
 * Todo controle tocável do app usa este componente; o lint de acessibilidade o vigia.
 */
import { useState } from 'react';
import { Pressable } from 'react-native';
import type { PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { useTema } from '../tema/TemaProvider';

export function Tocavel({ style, onFocus, onBlur, ...props }: PressableProps) {
  const { cores } = useTema();
  const [focado, setFocado] = useState(false);
  const anel: ViewStyle | null = focado ? { outlineWidth: 3, outlineStyle: 'solid', outlineColor: cores.focusRing, outlineOffset: 2 } : null;
  return (
    <Pressable
      {...props}
      onFocus={(e) => {
        setFocado(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocado(false);
        onBlur?.(e);
      }}
      style={(estado: PressableStateCallbackType): StyleProp<ViewStyle> => [typeof style === 'function' ? style(estado) : style, anel]}
    />
  );
}
