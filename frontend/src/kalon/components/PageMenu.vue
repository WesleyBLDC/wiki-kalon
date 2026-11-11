<template>
  <w-btn
    v-if="hasEntries"
    class="kalon-page-btn"
    flat
    dense
    round
    size="sm"
    icon="la:ellipsis-h"
    :aria-label="t('kalon.page.more')">
    <w-tooltip>{{ t('kalon.page.more') }}</w-tooltip>
    <w-menu
      class="kalon-page-menu"
      :anchor="`bottom ${endSide}`"
      :self="`top ${endSide}`"
      auto-close>
      <w-list dense padding>
        <!-- -> `.stop`: the menu closes on any click inside it, and a switch should show what it did -->
        <div class="kalon-page-menu-appearance" @click.stop>
          <div class="kalon-page-menu-label">{{ t('kalon.page.appearance') }}</div>
          <div class="kalon-segmented" role="group" :aria-label="t('kalon.page.appearance')">
            <button
              v-for="option of APPEARANCE_OPTIONS"
              :key="option.value"
              type="button"
              class="kalon-segmented-btn"
              :aria-pressed="userStore.appearance === option.value"
              @click="setAppearance(option.value)">
              {{ t(option.label) }}
            </button>
          </div>
        </div>
        <w-separator class="my-1" />
        <w-item v-if="showHistory" clickable @click="viewPageHistory">
          <w-item-section side><w-icon name="la:history" size="xs" /></w-item-section>
          <w-item-section>{{ t('kalon.page.history') }}</w-item-section>
        </w-item>
        <w-item v-if="showSource" clickable @click="viewPageSource">
          <w-item-section side><w-icon name="la:code" size="xs" /></w-item-section>
          <w-item-section>{{ t('kalon.page.source') }}</w-item-section>
        </w-item>
        <w-item v-if="siteStore.theme.showPrintBtn" clickable @click="printPage">
          <w-item-section side><w-icon name="la:print" size="xs" /></w-item-section>
          <w-item-section>{{ t('common.actions.print') }}</w-item-section>
        </w-item>
        <template v-if="userStore.can(`write:pages`)">
          <w-item clickable @click="togglePageProperties">
            <w-item-section side><w-icon name="la:pen-nib" size="xs" /></w-item-section>
            <w-item-section>{{ t('kalon.page.properties') }}</w-item-section>
          </w-item>
          <w-item v-if="flagsStore.experimental" clickable @click="togglePageData">
            <w-item-section side><w-icon name="la:project-diagram" size="xs" /></w-item-section>
            <w-item-section>{{ t('kalon.page.data') }}</w-item-section>
          </w-item>
        </template>
        <w-separator v-if="hasMoveGroup" class="my-1" />
        <w-item v-if="canDuplicate" clickable @click="duplicatePage">
          <w-item-section side><w-icon name="la:copy" size="xs" /></w-item-section>
          <w-item-section>{{ t('kalon.page.duplicate') }}</w-item-section>
        </w-item>
        <w-item v-if="userStore.can(`manage:pages`)" clickable @click="renamePage">
          <w-item-section side><w-icon name="la:share" size="xs" /></w-item-section>
          <w-item-section>{{ t('kalon.page.move') }}</w-item-section>
        </w-item>
        <w-item v-if="userStore.can(`write:pages`) && canConvert" clickable @click="convertPage">
          <w-item-section side><w-icon name="la:magic" size="xs" /></w-item-section>
          <w-item-section>{{ t('convertPage.action') }}</w-item-section>
        </w-item>
        <w-item v-if="userStore.can(`write:pages`) && hasBody" clickable @click="rerenderPage">
          <w-item-section side><w-icon name="la:sun" size="xs" /></w-item-section>
          <w-item-section>{{ t('kalon.page.rerender') }}</w-item-section>
        </w-item>
        <template v-if="userStore.can(`delete:pages`)">
          <w-separator class="my-1" />
          <w-item class="kalon-page-menu-danger" clickable @click="deletePage">
            <w-item-section side><w-icon name="la:trash" size="xs" /></w-item-section>
            <w-item-section>{{ t('kalon.page.delete') }}</w-item-section>
          </w-item>
        </template>
      </w-list>
    </w-menu>
  </w-btn>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { notifyRelinked } from '@/helpers/pageRelink'
import { useCommonStore } from '@/stores/common'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { APPEARANCE, useAppearance } from '../composables/appearance'
import { kalonMessages } from '../i18n'

/**
 * The page's ⋯ menu in the top bar: a Site, Light, Dark switch, then as labelled rows what the
 * right-hand action rail offers while a page is read, which Kalon hides in reading mode.
 *
 * The conditions and handlers are copied from `components/PageActionsCol.vue` (the computeds of the
 * same names, and the handler bodies), so each row appears for exactly whom the rail's button does.
 * Compare the two when replaying onto a new upstream release and carry any change over. Only offered
 * while reading: the top bar is not shown in the editor, where the rail keeps these.
 */

const commonStore = useCommonStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

const router = useRouter()
const { t } = useI18n({ messages: kalonMessages })
const { setAppearance } = useAppearance()

/** Site, Light, Dark: the account menu's three choices, set directly from here (see the board). */
const APPEARANCE_OPTIONS = [
  { value: APPEARANCE.SITE, label: 'kalon.page.appearanceSite' },
  { value: APPEARANCE.LIGHT, label: 'profile.appearanceLight' },
  { value: APPEARANCE.DARK, label: 'profile.appearanceDark' }
]

// COMPUTED (as PageActionsCol)

const isRedirect = computed(() => pageStore.editor === 'redirect')
const hasBody = computed(() => !['redirect', 'blog', 'feedback'].includes(pageStore.editor))
const isSaved = computed(() => Boolean(pageStore.id))
const canConvert = computed(() =>
  (pageStore.convertibleTo ?? []).some((editor) => siteStore.activeEditors.includes(editor))
)
const canViewSource = computed(
  () =>
    userStore.can('read:source') || userStore.can('write:pages') || userStore.can('manage:pages')
)
const canDuplicate = computed(() => canViewSource.value && userStore.canWriteOnSite)
const showHistory = computed(
  () => !isRedirect.value && isSaved.value && userStore.can('read:history')
)
const showSource = computed(() => hasBody.value && isSaved.value && canViewSource.value)

const hasMoveGroup = computed(
  () =>
    canDuplicate.value ||
    userStore.can('manage:pages') ||
    (userStore.can('write:pages') && (canConvert.value || hasBody.value))
)

// -> The appearance switch is always there, so the menu is offered for every saved page
const hasEntries = computed(() => isSaved.value)

/** The side the bar ends on, which a menu hanging off its buttons aligns to (as `PageHeader`). */
const endSide = computed(() =>
  siteStore.localeDir(commonStore.locale) === 'rtl' ? 'left' : 'right'
)

// METHODS (as PageActionsCol)

function togglePageProperties() {
  siteStore.$patch({ sideDialogComponent: 'PagePropertiesDialog', sideDialogShown: true })
}

function togglePageData() {
  siteStore.$patch({ sideDialogComponent: 'PageDataDialog', sideDialogShown: true })
}

function viewPageHistory() {
  siteStore.$patch({ overlay: 'PageHistory', overlayOpts: {} })
}

function viewPageSource() {
  siteStore.$patch({ overlay: 'PageSource', overlayOpts: {} })
}

function printPage() {
  window.print()
}

function convertPage() {
  dialog({
    component: defineAsyncComponent(() => import('@/components/PageConvertDialog.vue'))
  })
}

function rerenderPage() {
  dialog({
    component: defineAsyncComponent(() => import('@/components/RerenderPageDialog.vue')),
    componentProps: { id: pageStore.id }
  }).onOk(() => {
    pageStore.pageLoad({ id: pageStore.id })
  })
}

function duplicatePage() {
  dialog({
    component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'duplicatePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: pageStore.title,
      itemFileName: pageStore.path,
      locale: pageStore.locale
    }
  }).onOk((newPageOpts) => {
    pageStore.pageDuplicate({
      sourcePageId: pageStore.id,
      path: newPageOpts.path,
      title: newPageOpts.title,
      locale: newPageOpts.locale
    })
  })
}

function renamePage() {
  dialog({
    component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'renamePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: pageStore.title,
      itemFileName: pageStore.path,
      locale: pageStore.locale
    }
  }).onOk(async (renamedPageOpts) => {
    try {
      if (renamedPageOpts.path === pageStore.path && renamedPageOpts.locale === pageStore.locale) {
        await pageStore.pageRename({ id: pageStore.id, title: renamedPageOpts.title })
        notify({ type: 'positive', message: 'Page renamed successfully.' })
      } else {
        const relinked = await pageStore.pageMove({
          id: pageStore.id,
          path: renamedPageOpts.path,
          title: renamedPageOpts.title,
          locale: renamedPageOpts.locale,
          updateLinks: renamedPageOpts.updateLinks
        })
        notify({ type: 'positive', message: 'Page moved successfully.' })
        notifyRelinked(relinked, t)
      }
    } catch (err) {
      notify({ type: 'negative', message: err.message })
    }
  })
}

function deletePage() {
  dialog({
    component: defineAsyncComponent(() => import('@/components/PageDeleteDialog.vue')),
    componentProps: { pageId: pageStore.id, pageName: pageStore.title }
  }).onOk(() => {
    router.replace('/')
  })
}
</script>

<style lang="scss">
.kalon-page-menu {
  min-width: 220px;

  .w-item {
    min-height: 32px;
    margin-inline: 4px;
    border-radius: var(--kalon-radius-sm);
  }

  .w-item-section--side {
    padding-inline-end: 10px;
  }

  .kalon-page-menu-appearance {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 8px 6px;
  }

  .kalon-page-menu-label {
    color: var(--kalon-text-3);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .kalon-page-menu-danger {
    color: var(--color-negative);
  }
}

// -> A row of choices where the chosen one is raised, for a setting with a handful of values
.kalon-segmented {
  display: flex;
  padding: 2px;
  border-radius: var(--kalon-radius-sm);
  background-color: var(--kalon-hover);
}

.kalon-segmented-btn {
  flex: 1;
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--kalon-radius-xs);
  background: none;
  color: var(--kalon-text-2);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    color: var(--kalon-text);
  }

  &:focus-visible {
    outline: 2px solid var(--kalon-accent);
    outline-offset: -2px;
  }

  &[aria-pressed='true'] {
    background-color: var(--kalon-pop);
    box-shadow: 0 0 0 1px var(--kalon-border-strong);
    color: var(--kalon-text);
    font-weight: 500;
  }
}
</style>
