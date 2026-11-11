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

import { APPEARANCE, useAppearance } from '../composables/appearance'
import { useKalonI18n } from '../i18n'

/**
 * Light or dark in one click, beside the account: the opposite of what is on screen, set outright and
 * saved like the account menu's own choice (`composables/appearance.js`).
 */

const dark = useDark()
const { setAppearance } = useAppearance()
const { t } = useKalonI18n()

const label = computed(() =>
  dark.isActive ? t('kalon.sidebar.lightMode') : t('kalon.sidebar.darkMode')
)

function toggle() {
  setAppearance(dark.isActive ? APPEARANCE.LIGHT : APPEARANCE.DARK)
}
</script>
