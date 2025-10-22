# Chat Module Overview

This directory contains the client-side pieces that power GP-ConnecX direct messages. They pair with the backend chat API/Socket.IO namespace to provide end-to-end encrypted one-to-one messaging.

## Files

- `ChatProvider.jsx` wraps the app with context/state for conversations, sockets, and encryption. UI components consume `useChat()` to list/send messages.
- `chatCrypto.js` centralizes libsodium helpers for identity/ephemeral keys, handshake derivation, and message (de)cryption.
- `storage.js` abstracts persistent IndexedDB storage for keys, prekeys, and per-conversation state.

## Provider Responsibilities

`ChatProvider` handles several responsibilities that UI components no longer need to duplicate:

1. Bootstrapping: downloads socket metadata and previously published public keys (`/api/chat/bootstrap`) and ensures identity & DH key pairs exist locally.
2. Prekey management: auto-generates/sends batches of signed prekeys when supply runs low, and caches private counterparts in IndexedDB.
3. Socket lifecycle: connects to the `/chat` namespace with the JWT token, listens for `message_received`, `message_ack`, and `read` events, and forwards updates to local state.
4. Message persistence: encrypts outbound messages, records optimistic copies, and upserts server responses into per-conversation arrays.
5. Key state: derives shared secrets on the fly via libsodium, keeping counters/salts in IndexedDB so future messages can decrypt without re-handshaking.
6. Presence of reads/delivery: emits read receipts and maps ack events to optimistic messages.

## UI Integration

Any component wrapped in `ChatProvider` can access `useChat()` to:

- read `conversations`, `messages`, `ready`, `initializing`, etc.
- call `selectConversation(conversationId)` to load/switch threads
- call `startConversation(userId)` to create/find a DM and switch into it
- call `sendMessage(conversationId, text)` to enqueue an encrypted message

`MessagePanel.jsx` demonstrates this usage—rendering a conversation list with search, displaying decrypted messages, and offering a composer.

## IndexedDB Layout

`storage.js` initializes `gp-connect-chat` with stores:

- `keys`: holds persistent key pairs (identity, DH, metadata)
- `prekeys`: cached prekeys awaiting upload or reserved for peers
- `conversations`: per-conversation shared secret state and counters

Helper functions like `saveKey`, `countPrekeys`, `saveConversationState` provide concise wrappers for later reuse/testing.

## Notes & Next Steps

- Presence, typing indicators, and unread badge counts rely on backend events; ensure Redis is running locally so the namespace adapter/presence tracker succeed.
- The provider currently treats outbound payload errors optimistically; a future enhancement could retry failures or surface per-message actions (resend/delete).
- To reset chat state locally (for debugging), call `clearAll()` from `storage.js` in the browser console or expose a UI affordance.
- Always run `npm install` (front/back) to install libsodium, idb, and socket dependencies before `npm run dev` / `npm start`.
