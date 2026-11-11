import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { confirmDiscardUnsaved } from '@/composables/editorBuffer'
import { splitLocalePath } from '@/helpers/pagePaths'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * Where the site's logo leads, and what it does on the way out of the editor.
 *
 * A copy of `homePath` and `leaveEditorForHome` in `components/HeaderNav.vue`, which keep their own
 * because that header is upstream's and is left untouched. Compare the two when replaying onto a new
 * upstream release, and carry over any change made there; the reasoning is in that file's comments.
 */
export function useSiteHome() {
  const route = useRoute()
  const editorStore = useEditorStore()
  const pageStore = usePageStore()
  const siteStore = useSiteStore()
  const { t } = useI18n()

  /** Home in the locale being read: `/fr/...` goes back to `/fr`. */
  const homePath = computed(() => {
    const current = splitLocalePath(route.path, siteStore.localePrefixes)
    return (current && siteStore.localeUrlPrefix(current.locale)) || '/'
  })

  /** Out of the editor when the logo's link would go nowhere (a suggestion on the home page). */
  async function leaveEditorForHome() {
    if (!editorStore.isActive || route.path !== homePath.value) {
      return
    }
    if (!(await confirmDiscardUnsaved(t))) {
      return
    }
    editorStore.closeEditor()
    if (pageStore.id) {
      pageStore.pageLoad({ id: pageStore.id }).catch(() => {})
    }
  }

  return { homePath, leaveEditorForHome }
}
