import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { AtalhoIngresso } from './AtalhoIngresso';
import { INGRESSO } from './fixtures';

it('ingresso no topo com "Mostrar QR"', async () => {
  const onMostrar = jest.fn();
  await render(<TemaProvider><AtalhoIngresso ingresso={INGRESSO} onMostrar={onMostrar} /></TemaProvider>);
  expect(screen.getByText('Seu ingresso · Congressista')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar QR' }));
  expect(onMostrar).toHaveBeenCalled();
});
