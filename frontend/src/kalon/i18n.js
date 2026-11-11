import { useI18n } from 'vue-i18n'

/**
 * Kalon's own interface strings.
 *
 * Upstream keeps every string in one file, `backend/locales/en.json`, served from the locales
 * endpoint; adding keys there would be an unmarked edit to an upstream file. So Kalon components use a
 * LOCAL i18n scope instead: `t()` finds `kalon.*` keys here and falls through to the global strings for
 * everything else, in the reader's locale. A locale missing here falls back to English, as the global
 * scope does.
 */
export const kalonMessages = {
  en: {
    kalon: {
      tree: {
        pages: 'Pages',
        newPage: 'New page',
        newPageIn: 'New page in {title}',
        expand: 'Expand {title}',
        collapse: 'Collapse {title}'
      }
    }
  }
}

/** `useI18n` with Kalon's strings layered over the global ones. */
export function useKalonI18n() {
  return useI18n({ messages: kalonMessages })
}
