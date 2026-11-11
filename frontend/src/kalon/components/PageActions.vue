<template>
  <div class="kalon-page-actions">
    <span v-if="pageStore.updatedAt" class="kalon-page-edited">
      {{ t('kalon.page.edited', { date: userStore.formatDate(pageStore.updatedAt) }) }}
      <w-tooltip>{{ userStore.formatDateTime(t, pageStore.updatedAt) }}</w-tooltip>
    </span>

    <!--
      While properties changed from the reading view wait to be saved, upstream's own header row comes
      back with its reading actions beside Save and Discard; these would show the same buttons twice.
    -->
    <template v-if="!editorStore.hasPendingChanges">
      <w-btn
        v-if="userStore.authenticated && !isRedirect"
        class="kalon-page-btn"
        :class="{ 'is-on': pageStore.isWatching }"
        flat
        dense
        round
        size="sm"
        :icon="pageStore.isWatching ? `mdi:bell` : `la:bell`"
        :aria-label="pageStore.isWatching ? t(`common.page.unwatch`) : t(`common.page.watch`)"
        :aria-pressed="pageStore.isWatching"
        @click="toggleWatch">
        <w-tooltip>
          {{ pageStore.isWatching ? t('common.page.unwatch') : t('common.page.watch') }}
        </w-tooltip>
      </w-btn>

      <w-btn
        v-if="pageStore.canReview && !isRedirect"
        class="kalon-page-btn"
        :class="{ 'is-on': pendingCount > 0 }"
        flat
        dense
        round
        size="sm"
        :aria-label="t(`inbox.pendingReview`)">
        <w-icon :name="pendingCount > 0 ? `mdi:inbox-full` : `la:inbox`" />
        <w-badge v-if="pendingCount > 0" color="negative" rounded floating>
          <strong>{{ pendingCount }}</strong>
        </w-badge>
        <w-tooltip>{{ t('inbox.pendingReview') }}</w-tooltip>
        <w-menu
          class="kalon-page-menu"
          :anchor="`bottom ${endSide}`"
          :self="`top ${endSide}`"
          auto-close>
          <w-list padding style="min-width: 320px">
            <w-item v-if="pendingCount < 1">
              <w-item-section>
                <w-item-label caption>{{ t('inbox.reviewNone') }}</w-item-label>
              </w-item-section>
            </w-item>
            <w-item
              v-for="submission of pageStore.pendingSubmissions"
              :key="submission.id"
              clickable
              @click="reviewSubmission(submission)">
              <w-item-section>
                <w-item-label>
                  {{ submission.author.name || t('inbox.reviewUnknownAuthor') }}
                </w-item-label>
                <w-item-label caption>
                  {{ userStore.formatDateTime(t, submission.createdAt) }}
                </w-item-label>
              </w-item-section>
              <w-item-section v-if="submission.isStale" side>
                <w-badge color="warning" rounded>{{ t('inbox.reviewStale') }}</w-badge>
              </w-item-section>
            </w-item>
          </w-list>
        </w-menu>
      </w-btn>

      <page-menu />

      <template v-if="editAction !== EDIT_ACTION.NONE">
        <span v-if="pageStore.isEditLocked" class="kalon-page-edit-wrap" data-tooltip-anchor>
          <w-btn
            class="kalon-page-edit"
            unelevated
            color="primary"
            size="sm"
            icon="la:edit"
            :label="t(EDIT_LABEL[editAction])"
            no-caps
            disabled />
          <w-tooltip>{{ t('editor.editLockedTooltip') }}</w-tooltip>
        </span>
        <w-btn
          v-else
          class="kalon-page-edit"
          unelevated
          color="primary"
          size="sm"
          icon="la:edit"
          :label="t(EDIT_LABEL[editAction])"
          no-caps
          @click="runEditAction" />
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { useKalonI18n } from '../i18n'
import PageMenu from './PageMenu.vue'

/**
 * The page's actions in the top bar while it is read: when it was last edited, watch, the review
 * queue, the ⋯ menu, and Edit (or Suggest Edits).
 *
 * The conditions and handlers are copied from `components/PageHeader.vue` (`toggleWatch`, `editPage`,
 * `suggestEdits`, `reviewSubmission`, `pendingCount`, `isRedirect`, `endSide`), whose own reading
 * actions Kalon hides with CSS while leaving the file untouched. Compare the two when replaying onto a
 * new upstream release. Edit and Suggest are not offered on a phone, as upstream decides.
 */

const commonStore = useCommonStore()
const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

const router = useRouter()
const { t } = useKalonI18n()

/** What the primary button does: edit the page, suggest edits to it, or carry on with a suggestion. */
const EDIT_ACTION = Object.freeze({
  NONE: 'none',
  EDIT: 'edit',
  SUGGEST: 'suggest',
  CONTINUE_SUGGESTION: 'continueSuggestion'
})

const EDIT_LABEL = Object.freeze({
  [EDIT_ACTION.EDIT]: 'common.actions.edit',
  [EDIT_ACTION.SUGGEST]: 'common.actions.suggestEdits',
  [EDIT_ACTION.CONTINUE_SUGGESTION]: 'common.actions.continueSuggestion'
})

const isRedirect = computed(() => pageStore.editor === 'redirect')

/** As `PageHeader`: Edit for a writer, else Suggest Edits where the page takes suggestions. */
const editAction = computed(() => {
  if (userStore.can('write:pages')) {
    return EDIT_ACTION.EDIT
  }
  if (pageStore.canSuggestEdits && !isRedirect.value) {
    return pageStore.hasOpenSuggestion ? EDIT_ACTION.CONTINUE_SUGGESTION : EDIT_ACTION.SUGGEST
  }
  return EDIT_ACTION.NONE
})
const pendingCount = computed(() => pageStore.pendingSubmissions.length)
const endSide = computed(() =>
  siteStore.localeDir(commonStore.locale) === 'rtl' ? 'left' : 'right'
)

function editPage() {
  router.push(pageStore.editPath)
}

function runEditAction() {
  if (editAction.value === EDIT_ACTION.EDIT) {
    editPage()
  } else {
    suggestEdits()
  }
}

async function suggestEdits() {
  loading.show()
  try {
    await pageStore.pageSuggest()
  } catch (err) {
    notify(
      err.message === 'ERR_PAGE_EDIT_LOCKED'
        ? { type: 'negative', message: t('editor.editLocked'), caption: t('editor.editLockedHint') }
        : { type: 'negative', message: t('common.page.suggestFailed'), caption: err.message }
    )
  }
  loading.hide()
}

function reviewSubmission(submission) {
  router.push({ path: `/_inbox/review/${submission.id}`, query: { from: 'page' } })
}

async function toggleWatch() {
  const watching = !pageStore.isWatching
  try {
    await pageStore.pageWatch(watching)
  } catch (err) {
    notify({
      type: 'negative',
      message: t(watching ? 'common.page.watchFailed' : 'common.page.unwatchFailed'),
      caption: err.message
    })
  }
}
</script>

<style lang="scss">
.kalon-page-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.kalon-page-edited {
  margin-inline-end: 6px;
  color: var(--kalon-text-3);
  font-size: 0.8125rem;
  white-space: nowrap;

  @media (max-width: $breakpoint-xs-max) {
    display: none;
  }
}

.kalon-page-btn {
  color: var(--kalon-text-2);

  &.is-on {
    color: var(--kalon-accent-text);
  }

  &:not(:disabled):hover {
    background-color: var(--kalon-hover);
  }
}

.kalon-page-edit,
.kalon-page-edit-wrap {
  margin-inline-start: 6px;
}

.kalon-page-edit {
  border-radius: var(--kalon-radius-sm);
  font-weight: 500;
}

// -> As upstream: a page is edited on a machine with a keyboard, so not offered on a phone
@media (max-width: $breakpoint-xs-max) {
  .kalon-page-edit,
  .kalon-page-edit-wrap {
    display: none;
  }
}
</style>
