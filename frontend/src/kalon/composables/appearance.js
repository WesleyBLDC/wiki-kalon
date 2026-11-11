import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { useUserStore } from '@/stores/user'

/** The three appearance preferences a profile can hold, as the account menu offers them. */
export const APPEARANCE = Object.freeze({ SITE: 'site', LIGHT: 'light', DARK: 'dark' })

/**
 * Setting the reader's appearance preference, as `AccountMenu.vue` (`cycleAppearance`) does it:
 * applied at once (`App.vue` watches the preference and switches the theme), then saved to the
 * profile, and put back if the save fails. Logged out there is no profile, so it lasts for the visit.
 */
export function useAppearance() {
  const userStore = useUserStore()
  const { t } = useI18n()

  async function setAppearance(next) {
    const previous = userStore.appearance
    if (next === previous) {
      return
    }
    userStore.appearance = next
    if (!userStore.authenticated) {
      return
    }
    try {
      const resp = await API_CLIENT.put('users/profile', { json: { appearance: next } }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured')
      }
    } catch (err) {
      // -> Only if nothing else has changed it since: a second click already in flight wins
      if (userStore.appearance === next) {
        userStore.appearance = previous
      }
      notify({ type: 'negative', message: t('profile.saveFailed'), caption: apiErrorMessage(err) })
    }
  }

  return { setAppearance }
}
