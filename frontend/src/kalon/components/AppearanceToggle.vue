<template>
  <w-btn
    flat
    dense
    round
    size="sm"
    :icon="dark.isActive ? `la:sun` : `la:moon`"
    :aria-label="label"
    @click="toggle">
    <w-tooltip>{{ label }}</w-tooltip>
  </w-btn>
</template>

<script setup>
import { computed } from 'vue'

import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { useUserStore } from '@/stores/user'

import { useKalonI18n } from '../i18n'

/**
 * Light or dark in one click, beside the account. The same preference the account menu cycles through
 * (site, dark, light): this sets dark or light outright, the opposite of what is on screen, and saves
 * it to the profile the same way (`AccountMenu.vue`, `cycleAppearance`). Logged out there is no
 * profile, so it lasts for the visit.
 */

const dark = useDark()
const userStore = useUserStore()
const { t } = useKalonI18n()

const label = computed(() =>
  dark.isActive ? t('kalon.sidebar.lightMode') : t('kalon.sidebar.darkMode')
)

async function toggle() {
  const previous = userStore.appearance
  const next = dark.isActive ? 'light' : 'dark'
  // -> Applied at once: `App.vue` watches the preference and switches the theme
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
    if (userStore.appearance === next) {
      userStore.appearance = previous
    }
    notify({ type: 'negative', message: t('profile.saveFailed'), caption: apiErrorMessage(err) })
  }
}
</script>
