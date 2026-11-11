<template>
  <div
    v-if="showTags || showLastEditedBy"
    class="kalon-page-meta"
    :style="inset !== null ? { '--kalon-meta-inset': `${inset}px` } : null">
    <router-link
      v-for="tag of showTags ? pageStore.tags : []"
      :key="tag"
      class="kalon-page-tag"
      :to="tagBrowserRoute([tag])">
      <w-icon name="la:tags" size="xs" />
      {{ tag }}
    </router-link>
    <span v-if="showLastEditedBy" class="kalon-page-editor">
      <i18n-t keypath="kalon.page.editedBy" scope="parent">
        <template #name>
          <router-link :to="`/_user/${pageStore.authorId}`">{{ pageStore.authorName }}</router-link>
        </template>
      </i18n-t>
      <template v-if="pageStore.updatedAt">
        · {{ userStore.formatDateTime(t, pageStore.updatedAt) }}
      </template>
      <w-badge
        v-if="pageStore.editedVia === `mcp` && siteStore.showAiBadge"
        class="ms-2"
        color="purple"
        rounded>
        {{ t('common.page.aiBadge') }}
        <w-tooltip>{{ t('common.page.aiBadgeHint') }}</w-tooltip>
      </w-badge>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { tagBrowserRoute } from '@/helpers/tagBrowser'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { kalonMessages } from '../i18n'

/**
 * The page's tags and who last edited it and when, under the title instead of in the contents column,
 * lined up with the page icon and the description above it. Reads the page store only; no request of
 * its own. The same conditions as the contents column's sections
 * in `pages/Index.vue` (`showTags`, `showLastEditedBy`), which Kalon hides there. Tags are edited from
 * Properties, as before.
 */

defineProps({
  /** Where the header's icon starts when the header is lined up with the article, in px. */
  inset: {
    type: Number,
    default: null
  }
})

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

const { t } = useI18n({ messages: kalonMessages, useScope: 'local' })

const showTags = computed(() => pageStore.showTags && pageStore.tags?.length > 0)

const showLastEditedBy = computed(
  () => siteStore.features.lastEditedBy && pageStore.showLastEditedBy && Boolean(pageStore.authorId)
)
</script>

<style lang="scss">
.kalon-page-meta {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  // -> Where the header starts, as the page icon and the description do (`_overrides.scss`)
  padding-block: 0 12px;
  padding-inline: var(--kalon-meta-inset, 16px) 16px;
  color: var(--kalon-text-2);
  font-size: 0.8125rem;
}

.kalon-page-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background-color: var(--kalon-hover);
  color: var(--kalon-text-2);
  text-decoration: none;

  &:hover {
    background-color: var(--kalon-active);
    color: var(--kalon-text);
  }
}

.kalon-page-editor a {
  color: inherit;
  text-decoration: none;

  &:hover {
    color: var(--kalon-text);
    text-decoration: underline;
  }
}
</style>
