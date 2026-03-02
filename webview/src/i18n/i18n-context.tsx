import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  translate,
  type ConfiguredLocale,
  type I18nKey,
  type I18nSnapshot,
  type SupportedLocale,
} from '../../../src/shared/i18n/runtime';

export type { ConfiguredLocale, I18nSnapshot, SupportedLocale };

interface I18nContextValue {
  configuredLocale: ConfiguredLocale;
  resolvedLocale: SupportedLocale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
}

const DEFAULT_SNAPSHOT: I18nSnapshot = {
  configuredLocale: 'auto',
  resolvedLocale: 'en',
};

const I18nContext = createContext<I18nContextValue>({
  ...DEFAULT_SNAPSHOT,
  t: (key, params) => translate('en', key, params),
});

export function I18nProvider({
  snapshot,
  children,
}: {
  snapshot: I18nSnapshot;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => ({
    configuredLocale: snapshot.configuredLocale,
    resolvedLocale: snapshot.resolvedLocale,
    t: (key, params) => translate(snapshot.resolvedLocale, key, params),
  }), [snapshot.configuredLocale, snapshot.resolvedLocale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
