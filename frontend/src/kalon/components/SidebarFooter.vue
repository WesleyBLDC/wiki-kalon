<template>
  <div class="kalon-sidebar-footer">
    <template v-if="userStore.authenticated">
      <div class="kalon-sidebar-account">
        <account-menu ref="accountMenu" />
        <!-- -> The name opens the same menu as the avatar beside it, which is the control -->
        <button
          type="button"
          class="kalon-sidebar-name"
          tabindex="-1"
          aria-hidden="true"
          @click="openAccountMenu">
          {{ userStore.name }}
        </button>
      </div>
      <div class="kalon-sidebar-actions">
        <w-btn
          v-if="canCreate"
          flat
          dense
          round
          size="sm"
          icon="la:plus-circle"
          :aria-label="t('common.header.create')">
          <w-tooltip>{{ t('common.header.create') }}</w-tooltip>
          <new-menu offer-live-note />
        </w-btn>
        <w-btn
          flat
          dense
          round
          size="sm"
          icon="mdi:museum-outline"
          :aria-label="t('common.header.library')">
          <w-tooltip>{{ t('common.header.library') }}</w-tooltip>
          <header-library-menu />
        </w-btn>
        <w-btn
          flat
          dense
          round
          size="sm"
          icon="mdi:inbox-full"
          to="/_inbox"
          :aria-label="inboxLabel">
          <w-badge
            v-if="notificationsStore.badge"
            color="negative"
            rounded
            floating
            :label="notificationsStore.badge" />
          <w-tooltip>{{ inboxLabel }}</w-tooltip>
        </w-btn>
        <appearance-toggle />
        <w-btn
          v-if="userStore.can(`access:admin`)"
          flat
          dense
          round
          size="sm"
          icon="la:tools"
          to="/_admin"
          :aria-label="t('common.header.admin')">
          <w-tooltip>{{ t('common.header.admin') }}</w-tooltip>
        </w-btn>
      </div>
    </template>
    <template v-else>
      <w-btn
        class="kalon-sidebar-login"
        flat
        no-caps
        icon="la:sign-in-alt"
        :label="t('common.actions.login')"
        to="/login" />
      <w-btn
        flat
        dense
        round
        size="sm"
        icon="mdi:museum-outline"
        :aria-label="t('common.header.library')">
        <w-tooltip>{{ t('common.header.library') }}</w-tooltip>
        <header-library-menu />
      </w-btn>
      <appearance-toggle />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useLiveNoteStore } from '@/stores/liveNote'
import { useNotificationsStore } from '@/stores/notifications'
import { useUserStore } from '@/stores/user'

import AccountMenu from '@/components/AccountMenu.vue'
import HeaderLibraryMenu from '@/components/HeaderLibraryMenu.vue'
import NewMenu from '@/components/PageNewMenu.vue'

import AppearanceToggle from './AppearanceToggle.vue'

/**
 * The bottom of the sidebar on a wide screen, where the site header is folded away: the account, and
 * the header's New, Library, Inbox and Admin buttons, behind the same conditions `HeaderNav` uses, and
 * a light and dark switch (`AppearanceToggle.vue`). A narrow sidebar keeps the avatar and the buttons
 * and drops the name.
 */

const liveNoteStore = useLiveNoteStore()
const notificationsStore = useNotificationsStore()
const userStore = useUserStore()

const { t } = useI18n()

const accountMenu = ref(null)

/** As `HeaderNav`: somebody who may write pages somewhere, or create live notes. */
const canCreate = computed(() => userStore.can('write:pages') || liveNoteStore.canCreate)

/** As `HeaderNav`: the count is part of the name, so a screen reader hears the badge. */
const inboxLabel = computed(() =>
  notificationsStore.badge
    ? t('notifications.unreadLabel', { title: t('inbox.title'), count: notificationsStore.badge })
    : t('inbox.title')
)

function openAccountMenu() {
  accountMenu.value?.$el?.click()
}

/*
  Whether this session may create live notes, which `HeaderNav` asks for while it is mounted. With the
  header folded away the question is asked here, so New keeps offering live notes.
*/
watch(
  () => liveNoteStore.accessKey,
  () => {
    liveNoteStore.ensureAccess()
  },
  { immediate: true }
)
</script>

<style lang="scss">
.kalon-sidebar-footer {
  container: kalon-sidebar-footer / inline-size;
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  min-height: 48px;
  padding: 4px 8px;
  box-shadow: inset 0 1px 0 var(--kalon-border);
  color: var(--kalon-text-2);

  .w-btn {
    color: var(--kalon-text-2);
  }
  .w-btn:not(:disabled):hover {
    background-color: var(--kalon-hover);
  }
  .w-badge {
    --color-white: #fff;
  }
}

.kalon-sidebar-account {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;

  .account-avbtn {
    flex: none;
    margin: 0;
    color: var(--kalon-text-2);
  }
}

.kalon-sidebar-name {
  overflow: hidden;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--kalon-text);
  font: inherit;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.kalon-sidebar-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

@container kalon-sidebar-footer (max-width: 230px) {
  .kalon-sidebar-name {
    display: none;
  }
  .kalon-sidebar-actions {
    gap: 0;
  }
}

.kalon-sidebar-login {
  flex: 1;
  justify-content: flex-start;
}
</style>
