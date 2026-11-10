import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { cores } from '@acessa-evento/tokens';
import { TemaProvider } from '../tema/TemaProvider';
import { Tocavel } from './Tocavel';

const estilo = () => StyleSheet.flatten(screen.getByRole('button', { name: 'Ok' }).props.style) as Record<string, unknown>;

it('mostra o anel de foco de 3 pt com teclado ou switch, e tira ao sair', async () => {
  const onFocus = jest.fn();
  await render(
    <TemaProvider temaForcado="light">
      <Tocavel accessibilityRole="button" onPress={jest.fn()} onFocus={onFocus} style={{ minHeight: 48 }}><Text>Ok</Text></Tocavel>
    </TemaProvider>,
  );
  expect(estilo()['outlineWidth']).toBeUndefined();
  await fireEvent(screen.getByRole('button', { name: 'Ok' }), 'focus');
  expect(estilo()).toMatchObject({ outlineWidth: 3, outlineColor: cores.light.focusRing, minHeight: 48 });
  expect(onFocus).toHaveBeenCalled();
  await fireEvent(screen.getByRole('button', { name: 'Ok' }), 'blur');
  expect(estilo()['outlineWidth']).toBeUndefined();
});
