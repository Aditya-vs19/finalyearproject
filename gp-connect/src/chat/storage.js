const STORAGE_PREFIX = 'gp-connect:chat';

const safeWindow = typeof window !== 'undefined' ? window : null;

const buildKey = (scope, id) => `${STORAGE_PREFIX}:${scope}:${id}`;

export const saveComposerDraft = (conversationId, value) => {
  if (!safeWindow || !conversationId) {
    return;
  }
  const key = buildKey('draft', conversationId);
  if (!value) {
    safeWindow.localStorage.removeItem(key);
    return;
  }
  safeWindow.localStorage.setItem(key, value);
};

export const loadComposerDraft = (conversationId) => {
  if (!safeWindow || !conversationId) {
    return '';
  }
  const key = buildKey('draft', conversationId);
  return safeWindow.localStorage.getItem(key) || '';
};

export const rememberLastConversation = (conversationId) => {
  if (!safeWindow || !conversationId) {
    return;
  }
  safeWindow.localStorage.setItem(buildKey('last'), conversationId);
};

export const loadLastConversation = () => {
  if (!safeWindow) {
    return null;
  }
  return safeWindow.localStorage.getItem(buildKey('last'));
};

export const clearLastConversation = () => {
  if (!safeWindow) {
    return;
  }
  safeWindow.localStorage.removeItem(buildKey('last'));
};
