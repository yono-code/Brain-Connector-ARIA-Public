import * as vscode from 'vscode';
import {
  normalizeConfiguredLocale,
  resolveLocale,
  translate,
  type ConfiguredLocale,
  type I18nKey,
  type I18nSnapshot,
} from '../shared/i18n/runtime';

const LOCALE_CONFIG_KEY = 'aria.locale';

function tryGetWorkspaceConfiguration(): vscode.WorkspaceConfiguration | null {
  const getConfiguration = (
    vscode.workspace as { getConfiguration?: typeof vscode.workspace.getConfiguration }
  ).getConfiguration;
  if (typeof getConfiguration !== 'function') {
    return null;
  }
  return getConfiguration.call(vscode.workspace);
}

function getVscodeLanguage(): string {
  try {
    const env = (vscode as { env?: { language?: string } }).env;
    if (env && typeof env.language === 'string' && env.language.length > 0) {
      return env.language;
    }
  } catch {
    // Tests may provide a partial vscode mock without env export.
  }
  return 'en';
}

export function getConfiguredLocale(): ConfiguredLocale {
  const configuration = tryGetWorkspaceConfiguration();
  if (!configuration) {
    return 'auto';
  }
  const configured = configuration.get<string>(LOCALE_CONFIG_KEY, 'auto');
  return normalizeConfiguredLocale(configured);
}

export function getI18nSnapshot(): I18nSnapshot {
  const configuredLocale = getConfiguredLocale();
  return {
    configuredLocale,
    resolvedLocale: resolveLocale(configuredLocale, getVscodeLanguage()),
  };
}

export function tExt(
  key: I18nKey,
  params?: Record<string, string | number>,
): string {
  const snapshot = getI18nSnapshot();
  return translate(snapshot.resolvedLocale, key, params);
}

export async function setConfiguredLocale(
  locale: ConfiguredLocale,
): Promise<void> {
  const configuration = tryGetWorkspaceConfiguration();
  if (!configuration) {
    return;
  }
  await configuration.update(
    LOCALE_CONFIG_KEY,
    locale,
    vscode.ConfigurationTarget.Global,
  );
}
