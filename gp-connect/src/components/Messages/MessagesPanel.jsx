import React, { useMemo } from 'react';
import ConversationsList from './ConversationsList.jsx';
import ChatWindow from './ChatWindow.jsx';
import { ChatProvider, useChat } from './ChatProvider.jsx';
import './Messages.css';

const MessagesPanelInner = () => {
  const {
    conversations,
    messagesByConversation,
    activeConversationId,
    selectConversation,
    openConversationWithUser,
    sendMessage,
    loadingConversations,
    loadingMessages,
    socketConnected,
    presenceMap,
    typingMap,
    initializationError,
    retryInitialization,
  } = useChat();

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const activeMessages = activeConversationId
    ? messagesByConversation[activeConversationId] || []
    : [];

  return (
    <div className="dm-container">
      <ConversationsList
        onSelectConversation={selectConversation}
        onSelectUser={openConversationWithUser}
      />
      <div className="dm-main">
        {initializationError && (
          <div className="dm-error-banner">
            <span>{initializationError}</span>
            <button type="button" onClick={retryInitialization}>
              Retry
            </button>
          </div>
        )}
        {loadingConversations && (
          <div className="dm-loading-state">Loading conversations…</div>
        )}
        {!loadingConversations && (
          <ChatWindow
            conversation={activeConversation}
            messages={activeMessages}
            presence={activeConversation?.otherUser?._id ? presenceMap[activeConversation.otherUser._id] : null}
            typing={typingMap[activeConversationId]}
            onSend={(text) => sendMessage(activeConversationId, text)}
            socketConnected={socketConnected}
          />
        )}
        {loadingMessages && (
          <div className="dm-loading-messages">Loading messages…</div>
        )}
      </div>
    </div>
  );
};

const MessagesPanel = (props) => (
  <ChatProvider {...props}>
    <MessagesPanelInner />
  </ChatProvider>
);

export default MessagesPanel;
