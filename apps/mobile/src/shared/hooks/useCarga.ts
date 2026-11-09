/** Carrega um recurso uma vez (e de novo quando as dependências mudam), com estado de erro. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface Carga<T> {
  readonly dados: T | null;
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly recarregar: () => void;
}

export function useCarga<T>(carregar: () => Promise<T>, deps: DependencyList): Carga<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);
  const funcao = useRef(carregar);
  funcao.current = carregar;

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    funcao.current()
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // As dependências vêm de quem chama; a função atual fica no ref.
  }, [...deps, rodada]);

  const recarregar = useCallback(() => setRodada((r) => r + 1), []);
  return { dados, carregando, erro, recarregar };
}
