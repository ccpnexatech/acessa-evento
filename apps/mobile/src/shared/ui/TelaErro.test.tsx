import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../tema/TemaProvider';
import { TelaErro } from './TelaErro';

it('explica o erro sem detalhes técnicos e oferece tentar de novo', async () => {
  const onTentarDeNovo = jest.fn();
  await render(<TemaProvider><TelaErro onTentarDeNovo={onTentarDeNovo} /></TemaProvider>);
  expect(screen.getByRole('header', { name: 'Algo deu errado' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(onTentarDeNovo).toHaveBeenCalled();
});
