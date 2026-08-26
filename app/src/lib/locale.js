/* The active UI locale, shared with the formatters.

   Intl defaults to the browser's locale, which is not the same thing: a user
   reading the app in English on a French phone would get "37 836,24" under an
   English UI. The i18n provider pushes the chosen language here so numbers,
   currency and dates follow what is on screen. */

let current = 'en';
let override = null;

export function setFormatLocale(lang) { current = lang || 'en'; }

/* The admin console has hardcoded English copy, so it pins its own locale
   rather than inheriting whatever language the signed-in wallet user picked —
   otherwise it renders English labels beside French numbers and dates. */
export function setFormatOverride(lang) { override = lang; }

export function formatLocale() { return override || current; }
