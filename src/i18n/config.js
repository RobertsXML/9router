export const LOCALES = ["en", "vi", "zh-CN", "zh-TW", "ja", "pt-BR", "pt-PT", "ko", "es", "de", "fr", "he", "ar", "ru", "pl", "cs", "nl", "tr", "uk", "tl", "id", "th", "hi", "bn", "ur", "ro", "sv", "it", "el", "hu", "fi", "da", "no"];
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "locale";

const LOCALE_NAMES = {
  "en": "English",
  "vi": "Tiếng Việt",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "ja": "日本語",
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  "ko": "한국어",
  "es": "Español",
  "de": "Deutsch",
  "fr": "Français",
  "he": "עברית",
  "ar": "العربية",
  "ru": "Русский",
  "pl": "Polski",
  "cs": "Čeština",
  "nl": "Nederlands",
  "tr": "Türkçe",
  "uk": "Українська",
  "tl": "Tagalog",
  "id": "Indonesia",
  "th": "ไทย",
  "hi": "हिन्दी",
  "bn": "বাংলা",
  "ur": "اردو",
  "ro": "Română",
  "sv": "Svenska",
  "it": "Italiano",
  "el": "Ελληνικά",
  "hu": "Magyar",
  "fi": "Suomi",
  "da": "Dansk",
  "no": "Norsk"
};

const LOCALE_SET = new Set(LOCALES);

const LOCALE_NORMALIZE_MAP = new Map([
  ["zh", "zh-CN"],
  ["zh-CN", "zh-CN"],
  ["en", "en"],
  ["vi", "vi"],
  ["zh-TW", "zh-TW"],
  ["ja", "ja"],
  ["pt-BR", "pt-BR"],
  ["pt-PT", "pt-PT"],
  ["ko", "ko"],
  ["es", "es"],
  ["de", "de"],
  ["fr", "fr"],
  ["he", "he"],
  ["ar", "ar"],
  ["ru", "ru"],
  ["pl", "pl"],
  ["cs", "cs"],
  ["nl", "nl"],
  ["tr", "tr"],
  ["uk", "uk"],
  ["tl", "tl"],
  ["id", "id"],
  ["th", "th"],
  ["hi", "hi"],
  ["bn", "bn"],
  ["ur", "ur"],
  ["ro", "ro"],
  ["sv", "sv"],
  ["it", "it"],
  ["el", "el"],
  ["hu", "hu"],
  ["fi", "fi"],
  ["da", "da"],
  ["no", "no"],
]);

export function normalizeLocale(locale) {
  return LOCALE_NORMALIZE_MAP.get(locale) ?? DEFAULT_LOCALE;
}

export function isSupportedLocale(locale) {
  return LOCALE_SET.has(locale);
}
