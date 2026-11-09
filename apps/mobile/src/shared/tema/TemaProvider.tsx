/**
 * Tema do app: segue o claro/escuro do sistema. O alto contraste vem da
 * escolha da pessoa ou, se ela deixar "Como o sistema", do ajuste de contraste
 * do aparelho; quando ligado, vence a marca do evento (ADR 0011).
 * As telas leem só `useTema()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { cores } from '@acessa-evento/tokens';
import type { Tema } from '@acessa-evento/tokens';
import type { Cofre } from '../armazenamento/cofre';

export type PreferenciaContraste = 'sistema' | 'ligado' | 'desligado';
const PREFERENCIAS: readonly PreferenciaContraste[] = ['sistema', 'ligado', 'desligado'];
const CHAVE = 'preferencia-contraste';

export interface ValorTema {
  readonly tema: Tema;
  readonly cores: (typeof cores)[Tema];
  readonly contraste: PreferenciaContraste;
  readonly definirContraste: (p: PreferenciaContraste) => void;
}

const ContextoTema = createContext<ValorTema | null>(null);

export function resolverTema(esquema: 'light' | 'dark' | null | undefined, altoContraste: boolean): Tema {
  if (altoContraste) return 'alto-contraste';
  return esquema === 'dark' ? 'dark' : 'light';
}

export function contrasteAtivo(preferencia: PreferenciaContraste, sistema: boolean): boolean {
  return preferencia === 'sistema' ? sistema : preferencia === 'ligado';
}

/** Ajuste de contraste do aparelho: "Aumentar contraste" no iOS, "Texto em alto contraste" no Android. */
function useContrasteDoSistema(): boolean {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    let vivo = true;
    const ler = ios ? AccessibilityInfo.isDarkerSystemColorsEnabled : AccessibilityInfo.isHighTextContrastEnabled;
    void ler?.call(AccessibilityInfo).then((v) => vivo && setLigado(Boolean(v))).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(ios ? 'darkerSystemColorsChanged' : 'highTextContrastChanged', (v: boolean) => setLigado(v));
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);
  return ligado;
}

interface Props {
  /** Força o alto contraste (testes e telas de demonstração). */
  readonly altoContraste?: boolean;
  /** Onde guardar a escolha; sem ele, a escolha vale só até fechar o app. */
  readonly cofre?: Cofre;
  readonly children: ReactNode;
}

export function TemaProvider({ altoContraste, cofre, children }: Props) {
  const esquema = useColorScheme();
  const sistema = useContrasteDoSistema();
  const [contraste, setContraste] = useState<PreferenciaContraste>('sistema');

  useEffect(() => {
    if (!cofre) return;
    let vivo = true;
    void cofre.ler(CHAVE).then((v) => {
      if (vivo && v && (PREFERENCIAS as readonly string[]).includes(v)) setContraste(v as PreferenciaContraste);
    }).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [cofre]);

  const definirContraste = useCallback((p: PreferenciaContraste) => {
    setContraste(p);
    void cofre?.gravar(CHAVE, p).catch(() => undefined);
  }, [cofre]);

  const valor = useMemo<ValorTema>(() => {
    const tema = resolverTema(esquema, altoContraste ?? contrasteAtivo(contraste, sistema));
    return { tema, cores: cores[tema], contraste, definirContraste };
  }, [esquema, altoContraste, contraste, sistema, definirContraste]);
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error('useTema precisa estar dentro de <TemaProvider>.');
  return valor;
}
