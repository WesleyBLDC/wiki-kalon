<template>
  <div
    v-if="showTags || showLastEditedBy"
    class="kalon-page-meta"
    :class="{ 'has-icon': Boolean(pageStore.icon) }"
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

import { kalonMessages } from '../i18n'

/**
 * The page's tags and who last edited it, under the title instead of in the contents column, lined up
 * with the title's first letter. Reads the page store only; no request of its own. When it was edited
 * is in the top bar (`PageActions.vue`). The same conditions as the contents column's sections
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
  /*
    Where the title starts: the header's inset, the icon beside the title when there is one, and the
    title column's own padding (16px, 8px on a phone; see `PageHeader.vue`).
  */
  --kalon-meta-icon: 0px;
  padding-block: 0 16px;
  padding-inline: calc(var(--kalon-meta-inset, 16px) + var(--kalon-meta-icon) + 16px) 16px;
  color: var(--kalon-text-2);
  font-size: 0.8125rem;

  &.has-icon {
    --kalon-meta-icon: var(--kalon-title-icon);
  }

  @media (max-width: $breakpoint-xs-max) {
    padding-inline: calc(var(--kalon-meta-inset, 16px) + var(--kalon-meta-icon) + 8px) 8px;
  }
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
