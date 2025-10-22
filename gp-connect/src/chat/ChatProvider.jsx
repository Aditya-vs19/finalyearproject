export { ChatProvider, useChat } from '../components/Messages/ChatProvider.jsx';

/* Legacy implementation retained for reference.

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { chatAPI } from '../services/api.js';
	unreadCount: raw?.unreadCount || 0,
});

const mergeMessages = (current, incoming) => {
	const map = new Map();
	ensureArray(current).forEach((message) => {
		map.set(message.id || message.localId, message);
	});
	ensureArray(incoming).forEach((message) => {
		const key = message.id || message.localId;
		const existing = map.get(key) || {};
		map.set(key, { ...existing, ...message });
	});
	return Array.from(map.values()).sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	);
};

const decryptMessage = ({ raw, conversationId, userId, otherUserId }) => {
	let text = '';
	try {
		const decrypted = decryptConversationPayload({
			conversationId,
			userId,
			otherUserId,
			ciphertext: raw.ciphertext,
			nonce: raw.nonce,
			authTag: raw.authTag || raw.header?.authTag || null,
		});
		text = decrypted?.text || decrypted?.body || '';
	} catch (error) {
		text = '[Unable to decrypt]';
	}

	return {
		id: toId(raw._id),
		conversationId: toId(conversationId),
		senderId: toId(raw.senderId),
		recipientId: toId(raw.recipientId),
		ciphertext: raw.ciphertext,
		nonce: raw.nonce,
		authTag: raw.authTag || null,
		text,
		createdAt: new Date(raw.createdAt).toISOString(),
		deliveredAt: raw.deliveredAt ? new Date(raw.deliveredAt).toISOString() : null,
		readAt: raw.readAt ? new Date(raw.readAt).toISOString() : null,
		status: raw.readAt ? 'read' : raw.deliveredAt ? 'delivered' : 'sent',
	};
};

export const ChatProvider = ({ currentUser, children }) => {
	const userId = toId(currentUser?._id);
	const [conversations, setConversations] = useState([]);
	const [activeConversationId, setActiveConversationId] = useState(null);
	const [messagesByConversation, setMessagesByConversation] = useState({});
	const [loadingConversations, setLoadingConversations] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);
	const [socketConnected, setSocketConnected] = useState(false);
	const [typingIndicators, setTypingIndicators] = useState({});
	const [presenceMap, setPresenceMap] = useState({});

	const socketRef = useRef(null);
	const paginationRef = useRef(new Map());
	const readCursorRef = useRef(new Map());
	const typingTimeoutRef = useRef(new Map());
	const previousConversationRef = useRef(null);

	const conversationLookup = useMemo(() => {
		const map = new Map();
		conversations.forEach((conversation) => {
			map.set(conversation.conversationId, conversation);
		});
		return map;
	}, [conversations]);

	const disconnectSocket = useCallback(() => {
		if (socketRef.current) {
			socketRef.current.removeAllListeners();
			socketRef.current.disconnect();
			socketRef.current = null;
		}
		setSocketConnected(false);
	}, []);

	const updateConversations = useCallback((nextItems) => {
		setConversations((prev) => {
			const map = new Map();
			prev.forEach((item) => map.set(item.conversationId, item));
			ensureArray(nextItems).forEach((item) => {
				map.set(item.conversationId, {
					...map.get(item.conversationId),
					...item,
				});
			});
			return Array.from(map.values()).sort((a, b) => {
				const aTime = new Date(a.lastMessageAt || 0).getTime();
				const bTime = new Date(b.lastMessageAt || 0).getTime();
				return bTime - aTime;
			});
		});
	}, []);

	const storeMessages = useCallback((conversationId, nextMessages) => {
		setMessagesByConversation((prev) => ({
			...prev,
			[conversationId]: mergeMessages(prev[conversationId] || [], nextMessages),
		}));
	}, []);

	const markLocalRead = useCallback(
		(conversationId, uptoMessageId) => {
			storeMessages(conversationId, [
				{
					id: uptoMessageId,
					readAt: new Date().toISOString(),
					status: 'read',
				},
			]);
		},
		[storeMessages]
	);

	const handlePresence = useCallback((payload) => {
		if (!payload?.userId) {
			return;
		}
		setPresenceMap((prev) => ({
			...prev,
			[toId(payload.userId)]: {
				online: !!payload.online,
				lastSeen: payload.lastSeen ? new Date(payload.lastSeen).toISOString() : null,
			},
		}));
	}, []);

	const markConversationAsRead = useCallback(
		async (conversationId, uptoMessageId) => {
			if (!conversationId || !uptoMessageId) {
				return;
			}
			try {
				await chatAPI.markRead({ conversationId, uptoMessageId });
				markLocalRead(conversationId, uptoMessageId);
			} catch (error) {
				console.error('Failed to mark conversation as read:', error);
			}
		},
		[markLocalRead]
	);

	const handleIncomingMessage = useCallback(
		(conversationId, rawMessage) => {
			const conversation = conversationLookup.get(conversationId);
			const otherUserId = conversation?.otherUser?._id;
			const message = decryptMessage({
				raw: rawMessage,
				conversationId,
				userId,
				otherUserId,
			});

			storeMessages(conversationId, [message]);

			updateConversations([
				{
					conversationId,
					lastMessagePreview: buildPreview(message.text),
					lastMessageAt: message.createdAt,
					unreadCount:
						conversationId === activeConversationId || message.senderId === userId
							? 0
							: (conversation?.unreadCount || 0) + 1,
				},
			]);

			if (conversationId === activeConversationId && message.senderId !== userId) {
				readCursorRef.current.set(conversationId, message.id);
				markConversationAsRead(conversationId, message.id);
			}
		},
		[activeConversationId, conversationLookup, markConversationAsRead, storeMessages, updateConversations, userId]
	);

	const connectSocket = useCallback(
		(bootstrap) => {
			const token = bootstrap?.socketAuthToken || localStorage.getItem('token');
			if (!token) {
				return;
			}

			const urlBase = bootstrap?.socketUrl || 'http://localhost:5000';
			const namespace = bootstrap?.socketNamespace || '/chat';

			const socket = io(`${urlBase}${namespace}`, {
				transports: ['websocket', 'polling'],
				auth: { token },
			});

			socketRef.current = socket;

			socket.on('connect', () => {
				setSocketConnected(true);
				if (activeConversationId) {
					socket.emit('join_conversation', { conversationId: activeConversationId });
				}
			});

			socket.on('disconnect', () => {
				setSocketConnected(false);
			});

			socket.on('message_received', ({ conversationId, message }) => {
				if (!conversationId || !message) {
					return;
				}
				try {
					handleIncomingMessage(toId(conversationId), message);
				} catch (error) {
					console.error('Failed to process incoming message:', error);
					toast.error('Could not decrypt a message.');
				}
			});

			socket.on('message_ack', ({ conversationId, messageId, deliveredAt }) => {
				if (!conversationId || !messageId) {
					return;
				}
				storeMessages(toId(conversationId), [
					{
						id: toId(messageId),
						deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : new Date().toISOString(),
						status: 'delivered',
					},
				]);
			});

			socket.on('typing', ({ conversationId, fromUserId, isTyping }) => {
				if (!conversationId || toId(fromUserId) === userId) {
					return;
				}
				setTypingIndicators((prev) => ({
					...prev,
					[toId(conversationId)]: {
						isTyping: !!isTyping,
						updatedAt: Date.now(),
					},
				}));
			});

			socket.on('presence', handlePresence);

			socket.on('read', ({ conversationId, uptoMessageId, readerId, readAt }) => {
				if (!conversationId || toId(readerId) === userId) {
					return;
				}
				storeMessages(toId(conversationId), [
					{
						id: toId(uptoMessageId),
						readAt: readAt ? new Date(readAt).toISOString() : new Date().toISOString(),
						status: 'read',
					},
				]);
			});
		},
		[activeConversationId, handleIncomingMessage, handlePresence, storeMessages, userId]
	);

	const loadMessages = useCallback(
		async (conversationId, { initial = false, loadMore = false } = {}) => {
			if (!conversationId) {
				return;
			}

			const key = toId(conversationId);
			const pagination = paginationRef.current.get(key) || {};
			const hasMessages = (messagesByConversation[key] || []).length > 0;

			if (initial && hasMessages) {
				return;
			}

			if (loadMore && !pagination.nextCursor) {
				return;
			}

			if (!loadMore) {
				setLoadingMessages(true);
			}

			try {
				const response = await chatAPI.listMessages({
					conversationId,
					limit: 40,
					cursor: loadMore ? pagination.nextCursor : undefined,
				});

				const otherUserId = conversationLookup.get(key)?.otherUser?._id;
				const mapped = ensureArray(response.data?.messages).map((item) =>
					decryptMessage({ raw: item, conversationId, userId, otherUserId })
				);

				storeMessages(key, mapped);
				paginationRef.current.set(key, {
					nextCursor: response.data?.nextCursor || null,
				});
			} catch (error) {
				console.error('Failed to load messages:', error);
				toast.error('Unable to load messages for this conversation.');
			} finally {
				if (!loadMore) {
					setLoadingMessages(false);
				}
			}
		},
		[conversationLookup, messagesByConversation, storeMessages, userId]
	);

	const bootstrapChat = useCallback(async () => {
		if (!userId) {
			return;
		}
		setLoadingConversations(true);
		try {
			const [bootstrapRes, conversationsRes] = await Promise.all([
				chatAPI.bootstrap(),
				chatAPI.listConversations(),
			]);

			const mapped = ensureArray(conversationsRes.data).map(normalizeConversation);
			setConversations(mapped);

			connectSocket(bootstrapRes.data);

			const remembered = loadLastConversation();
			const initial = mapped.find((item) => item.conversationId === remembered) || mapped[0];
			if (initial) {
				setActiveConversationId(initial.conversationId);
				loadMessages(initial.conversationId, { initial: true });
			} else {
				setActiveConversationId(null);
				clearLastConversation();
			}
		} catch (error) {
			console.error('Failed to bootstrap chat:', error);
			toast.error('Unable to load conversations.');
		} finally {
			setLoadingConversations(false);
		}
	}, [connectSocket, loadMessages, userId]);

	useEffect(() => {
		setConversations([]);
		setMessagesByConversation({});
		paginationRef.current.clear();
		readCursorRef.current.clear();
		previousConversationRef.current = null;

		if (!userId) {
			disconnectSocket();
			return;
		}

		bootstrapChat();

		return () => {
			disconnectSocket();
		};
	}, [bootstrapChat, disconnectSocket, userId]);

	const joinConversationRoom = useCallback((conversationId) => {
		if (!socketRef.current || !conversationId) {
			return;
		}
		socketRef.current.emit('join_conversation', { conversationId });
	}, []);

	const leaveConversationRoom = useCallback((conversationId) => {
		if (!socketRef.current || !conversationId) {
			return;
		}
		socketRef.current.emit('leave_conversation', { conversationId });
	}, []);

	const handleActiveConversation = useCallback(
		(conversationId) => {
			const key = conversationId ? toId(conversationId) : null;
			const previous = previousConversationRef.current;

			if (previous && previous !== key) {
				leaveConversationRoom(previous);
			}

			if (key) {
				joinConversationRoom(key);
				rememberLastConversation(key);
				updateConversations([
					{
						conversationId: key,
						unreadCount: 0,
					},
				]);
				loadMessages(key, { initial: true });

				const messages = messagesByConversation[key] || [];
				const lastIncoming = [...messages]
					.filter((item) => item.senderId !== userId)
					.pop();
				if (lastIncoming) {
					readCursorRef.current.set(key, lastIncoming.id);
					markConversationAsRead(key, lastIncoming.id);
				}
			} else {
				clearLastConversation();
			}

			previousConversationRef.current = key;
		},
		[joinConversationRoom, leaveConversationRoom, loadMessages, markConversationAsRead, messagesByConversation, updateConversations, userId]
	);

	const setActiveConversation = useCallback(
		(conversationId) => {
			const key = conversationId ? toId(conversationId) : null;
			setActiveConversationId(key);
			handleActiveConversation(key);
		},
		[handleActiveConversation]
	);

	useEffect(() => {
		if (!activeConversationId) {
			return;
		}
		const messages = messagesByConversation[activeConversationId] || [];
		const lastIncoming = [...messages]
			.filter((item) => item.senderId !== userId)
			.pop();
		if (!lastIncoming) {
			return;
		}
		if (readCursorRef.current.get(activeConversationId) === lastIncoming.id) {
			return;
		}
		readCursorRef.current.set(activeConversationId, lastIncoming.id);
		markConversationAsRead(activeConversationId, lastIncoming.id);
	}, [activeConversationId, markConversationAsRead, messagesByConversation, userId]);

	const setComposerTyping = useCallback(
		(conversationId, isTyping) => {
			if (!conversationId || !socketRef.current) {
				return;
			}

			const key = toId(conversationId);
			const timeout = typingTimeoutRef.current.get(key);
			if (timeout) {
				clearTimeout(timeout);
			}

			socketRef.current.emit('typing', {
				conversationId: key,
				toUserId: conversationLookup.get(key)?.otherUser?._id,
				isTyping,
			});

			if (isTyping) {
				const timer = setTimeout(() => {
					typingTimeoutRef.current.delete(key);
					socketRef.current?.emit('typing', {
						conversationId: key,
						toUserId: conversationLookup.get(key)?.otherUser?._id,
						isTyping: false,
					});
				}, 4000);
				typingTimeoutRef.current.set(key, timer);
			}
		},
		[conversationLookup]
	);

	const sendMessage = useCallback(
		async (conversationId, content) => {
			if (!conversationId || !content?.trim()) {
				return;
			}

			const key = toId(conversationId);
			const conversation = conversationLookup.get(key);
			const otherUserId = conversation?.otherUser?._id;
			if (!otherUserId) {
				toast.error('Unable to send message – missing recipient.');
				return;
			}

			const text = content.trim();
			const createdAt = new Date().toISOString();
			const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

			const { ciphertext, nonce, authTag } = encryptConversationPayload({
				conversationId: key,
				userId,
				otherUserId,
				payload: { text, createdAt },
			});

			const optimistic = {
				id: localId,
				localId,
				conversationId: key,
				senderId: userId,
				recipientId: otherUserId,
				text,
				ciphertext,
				nonce,
				authTag,
				createdAt,
				status: 'sending',
			};

			storeMessages(key, [optimistic]);
			updateConversations([
				{
					conversationId: key,
					lastMessagePreview: buildPreview(text),
					lastMessageAt: createdAt,
					unreadCount: 0,
				},
			]);

			saveComposerDraft(key, '');

			const payload = {
				conversationId: key,
				toUserId: otherUserId,
				ciphertext,
				nonce,
				authTag,
				header: {
					version: 1,
					preview: buildPreview(text),
					createdAt,
				},
			};

			const handleSuccess = (messageId, deliveredAt) => {
				storeMessages(key, [
					{
						id: localId,
						status: deliveredAt ? 'delivered' : 'sent',
						deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : new Date().toISOString(),
						serverId: messageId,
					},
				]);
			};

			const handleFailure = (message) => {
				storeMessages(key, [
					{
						id: localId,
						status: 'error',
						error: message,
					},
				]);
				toast.error(message || 'Message failed to send.');
			};

			if (socketConnected && socketRef.current) {
				socketRef.current.emit('send_message', payload, (response) => {
					if (!response?.ok) {
						handleFailure(response?.error || 'Message failed to send.');
						return;
					}
					handleSuccess(response.messageId, response.deliveredAt);
				});
				return;
			}

			try {
				const response = await chatAPI.sendMessage(payload);
				handleSuccess(response.data?.messageId, response.data?.deliveredAt);
			} catch (error) {
				console.error('Failed to send message via REST fallback:', error);
				handleFailure('Message failed to send.');
			}
		},
		[conversationLookup, saveComposerDraft, socketConnected, storeMessages, updateConversations, userId]
	);

	const createConversation = useCallback(
		async (participantId) => {
			if (!participantId) {
				return null;
			}
			try {
				const response = await chatAPI.ensureConversation({ participantId });
				const conversation = normalizeConversation({
					conversationId: response.data?.conversationId,
					otherUser: response.data?.participants?.other,
					lastMessageAt: new Date().toISOString(),
					unreadCount: 0,
				});
				updateConversations([conversation]);
				setActiveConversation(conversation.conversationId);
				return conversation.conversationId;
			} catch (error) {
				const message = error.response?.data?.message || 'Unable to start chat.';
				toast.error(message);
				throw error;
			}
		},
		[setActiveConversation, updateConversations]
	);

	const value = useMemo(
		() => ({
			userId,
			conversations,
			activeConversationId,
			setActiveConversation,
			createConversation,
			loadingConversations,
			presenceMap,
			messagesByConversation,
			loadingMessages,
			loadMessages,
			sendMessage,
			setComposerTyping,
			typingIndicators,
			socketConnected,
			saveComposerDraft,
			loadComposerDraft,
		}),
		[
			activeConversationId,
			conversations,
			createConversation,
			loadComposerDraft,
			loadMessages,
			loadingConversations,
			loadingMessages,
			presenceMap,
			sendMessage,
			setActiveConversation,
			setComposerTyping,
			socketConnected,
			typingIndicators,
			saveComposerDraft,
			userId,
		]
	);

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error('useChat must be used within a ChatProvider');
	}
	return context;
};

*/
