/**
 * Tema do app: segue o claro/escuro do sistema, e o alto contraste escolhido
 * pela pessoa vence sempre (ADR 0011). As telas leem só `useTema()`.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { cores } from '@acessa-evento/tokens';
import type { Tema } from '@acessa-evento/tokens';

export interface ValorTema {
  readonly tema: Tema;
  readonly cores: (typeof cores)[Tema];
}

const ContextoTema = createContext<ValorTema | null>(null);

export function resolverTema(esquema: 'light' | 'dark' | null | undefined, altoContraste: boolean): Tema {
  if (altoContraste) return 'alto-contraste';
  return esquema === 'dark' ? 'dark' : 'light';
}

interface Props {
  readonly altoContraste?: boolean;
  readonly children: ReactNode;
}

export function TemaProvider({ altoContraste = false, children }: Props) {
  const esquema = useColorScheme();
  const valor = useMemo<ValorTema>(() => {
    const tema = resolverTema(esquema, altoContraste);
    return { tema, cores: cores[tema] };
  }, [esquema, altoContraste]);
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error('useTema precisa estar dentro de <TemaProvider>.');
  return valor;
}
