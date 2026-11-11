<template>
  <w-btn
    v-if="isSaved"
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
        <template v-for="group of groups" :key="group.key">
          <w-separator class="my-1" />
          <w-item
            v-for="row of group.rows"
            :key="row.key"
            :class="{ 'kalon-page-menu-danger': row.isDanger }"
            clickable
            @click="row.run">
            <w-item-section side><w-icon :name="row.icon" size="xs" /></w-item-section>
            <w-item-section>{{ t(row.label) }}</w-item-section>
          </w-item>
        </template>
      </w-list>
    </w-menu>
  </w-btn>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'

import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { notifyRelinked } from '@/helpers/pageRelink'
import { useCommonStore } from '@/stores/common'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { APPEARANCE, useAppearance } from '../composables/appearance'
import { useKalonI18n } from '../i18n'

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
const { t } = useKalonI18n()
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

/**
 * The rows under the appearance switch, in three groups (reading, moving and changing, deleting), each
 * row there only for whom the rail's matching button is. A rule goes above each group that has a row,
 * so none is drawn twice or left dangling.
 */
const groups = computed(() => {
  const canWrite = userStore.can('write:pages')
  return [
    {
      key: 'reading',
      rows: [
        showHistory.value && {
          key: 'history',
          icon: 'la:history',
          label: 'kalon.page.history',
          run: viewPageHistory
        },
        showSource.value && {
          key: 'source',
          icon: 'la:code',
          label: 'kalon.page.source',
          run: viewPageSource
        },
        siteStore.theme.showPrintBtn && {
          key: 'print',
          icon: 'la:print',
          label: 'common.actions.print',
          run: printPage
        },
        canWrite && {
          key: 'properties',
          icon: 'la:pen-nib',
          label: 'kalon.page.properties',
          run: togglePageProperties
        },
        canWrite &&
          flagsStore.experimental && {
            key: 'data',
            icon: 'la:project-diagram',
            label: 'kalon.page.data',
            run: togglePageData
          }
      ]
    },
    {
      key: 'change',
      rows: [
        canDuplicate.value && {
          key: 'duplicate',
          icon: 'la:copy',
          label: 'kalon.page.duplicate',
          run: duplicatePage
        },
        userStore.can('manage:pages') && {
          key: 'move',
          icon: 'la:share',
          label: 'kalon.page.move',
          run: renamePage
        },
        canWrite &&
          canConvert.value && {
            key: 'convert',
            icon: 'la:magic',
            label: 'convertPage.action',
            run: convertPage
          },
        canWrite &&
          hasBody.value && {
            key: 'rerender',
            icon: 'la:sun',
            label: 'kalon.page.rerender',
            run: rerenderPage
          }
      ]
    },
    {
      key: 'delete',
      rows: [
        userStore.can('delete:pages') && {
          key: 'delete',
          icon: 'la:trash',
          label: 'kalon.page.delete',
          run: deletePage,
          isDanger: true
        }
      ]
    }
  ]
    .map((group) => ({ ...group, rows: group.rows.filter(Boolean) }))
    .filter((group) => group.rows.length > 0)
})

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
