<template>
  <div class="kalon-section-label">{{ t('kalon.sidebar.menu') }}</div>
</template>

<script setup>
import { useKalonI18n } from '../i18n'

/** "Menu", over the curated navigation menu, as "Pages" heads the tree under it. */

const { t } = useKalonI18n()
</script>

<style lang="scss">
.kalon-section-label {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-inline: 8px;
  padding-inline: 8px;
  color: var(--kalon-text-3);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
</style>
