'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type TargetLocale = 'en' | 'es';

type TranslateState =
  | 'idle'
  | 'detecting'
  | 'translating'
  | 'translated'
  | 'showing-original'
  | 'same-language'
  | 'error';

type Props = {
  text: string;
  targetLocale: TargetLocale;
  className?: string;
  children: (displayText: string, button: ReactNode) => ReactNode;
};

const CACHE_MAX = 200;
const translationCache = new Map<string, string>();

function cacheKey(targetLocale: string, text: string) {
  return `${targetLocale}::${text}`;
}

function cacheSet(key: string, value: string) {
  if (translationCache.size >= CACHE_MAX) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey !== undefined) translationCache.delete(firstKey);
  }
  translationCache.set(key, value);
}

function useTranslateLabels() {
  const intl = useTranslations('Translate');
  return {
    TranslateButton: intl('TranslateButton'),
    ShowOriginal: intl('ShowOriginal'),
    Translating: intl('Translating'),
    Detecting: intl('Detecting'),
    SameLanguage: intl('SameLanguage'),
    TranslateError: intl('TranslateError'),
  };
}

export default function TranslateButton({ text, targetLocale, className, children }: Props) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<TranslateState>('idle');
  const [translated, setTranslated] = useState<string | null>(null);
  const labels = useTranslateLabels();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasTranslator = 'Translator' in window;
    const hasDetector = 'LanguageDetector' in window;
    setSupported(hasTranslator && hasDetector);
  }, []);

  // Reset cached translation when text or target changes.
  useEffect(() => {
    setTranslated(null);
    setState('idle');
  }, [text, targetLocale]);

  // Pre-populate from module-level cache without making an API call.
  useEffect(() => {
    const key = cacheKey(targetLocale, text);
    const cached = translationCache.get(key);
    if (cached !== undefined) {
      setTranslated(cached);
      // Stay in 'idle' until the user clicks; we just have the value ready.
    }
  }, [text, targetLocale]);

  async function handleClick() {
    if (!supported) return;

    // Toggle paths that don't need the API.
    if (state === 'translated') {
      setState('showing-original');
      return;
    }
    if (state === 'showing-original' && translated !== null) {
      setState('translated');
      return;
    }

    const key = cacheKey(targetLocale, text);
    const cached = translationCache.get(key);
    if (cached !== undefined) {
      setTranslated(cached);
      setState('translated');
      return;
    }

    if (typeof window === 'undefined') {
      setState('error');
      return;
    }
    const detectorApi = window.LanguageDetector;
    const translatorApi = window.Translator;
    if (!detectorApi || !translatorApi) {
      setState('error');
      return;
    }

    try {
      setState('detecting');
      const detector = await detectorApi.create();
      const results = await detector.detect(text);
      const detectedLanguage = results[0]?.detectedLanguage;

      if (!detectedLanguage) {
        setState('error');
        return;
      }

      if (detectedLanguage === targetLocale) {
        setState('same-language');
        return;
      }

      setState('translating');
      const translator = await translatorApi.create({
        sourceLanguage: detectedLanguage,
        targetLanguage: targetLocale,
      });
      const result = await translator.translate(text);
      cacheSet(key, result);
      setTranslated(result);
      setState('translated');
    } catch {
      setState('error');
    }
  }

  let label: string;
  let title: string | undefined;
  switch (state) {
    case 'detecting':
      label = labels.Detecting;
      title = labels.Detecting;
      break;
    case 'translating':
      label = labels.Translating;
      title = labels.Translating;
      break;
    case 'translated':
      label = labels.ShowOriginal;
      title = labels.ShowOriginal;
      break;
    case 'showing-original':
      label = labels.TranslateButton;
      title = labels.TranslateButton;
      break;
    case 'same-language':
      label = labels.TranslateButton;
      title = labels.SameLanguage;
      break;
    case 'error':
      label = labels.TranslateButton;
      title = labels.TranslateError;
      break;
    case 'idle':
    default:
      label = labels.TranslateButton;
      title = labels.TranslateButton;
      break;
  }

  const displayText = state === 'translated' && translated !== null ? translated : text;

  const button = supported ? (
    <button
      type="button"
      className={`translate-link ${className ?? ''}`.trim()}
      onClick={handleClick}
      disabled={state === 'detecting' || state === 'translating' || state === 'same-language'}
      title={title}
      data-state={state}
    >
      {label}
    </button>
  ) : null;

  return <>{children(displayText, button)}</>;
}

type TranslatorApi = {
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<{ translate(text: string): Promise<string> }>;
};

type LanguageDetectorApi = {
  create(): Promise<{
    detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
  }>;
};

declare global {
  interface Window {
    Translator?: TranslatorApi;
    LanguageDetector?: LanguageDetectorApi;
  }
}
