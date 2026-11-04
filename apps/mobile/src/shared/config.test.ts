import { normalizarUrlApi } from './config';

describe('normalizarUrlApi', () => {
  it('tira a barra do fim e espaços', () => {
    expect(normalizarUrlApi(' http://10.0.1.21:3333/ ')).toBe('http://10.0.1.21:3333');
  });
  it('usa localhost quando não há valor', () => {
    expect(normalizarUrlApi(undefined)).toBe('http://localhost:3333');
    expect(normalizarUrlApi('')).toBe('http://localhost:3333');
  });
});
