import React, { useMemo, useState, useEffect } from 'react';
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

  // Mobile navigation state
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 700);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset mobile chat view when conversation changes
  useEffect(() => {
    if (isMobile && activeConversationId) {
      setShowChat(true);
    }
  }, [activeConversationId, isMobile]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const activeMessages = activeConversationId
    ? messagesByConversation[activeConversationId] || []
    : [];

  const handleSelectConversation = (conversationId) => {
    selectConversation(conversationId);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleSelectUser = (userId) => {
    openConversationWithUser(userId);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBackToList = () => {
    setShowChat(false);
  };

  // Mobile view: show either conversations list or chat
  if (isMobile) {
    return (
      <div className="dm-container dm-mobile">
        {!showChat ? (
          <div className="dm-mobile-conversations">
            <ConversationsList
              onSelectConversation={handleSelectConversation}
              onSelectUser={handleSelectUser}
            />
          </div>
        ) : (
          <div className="dm-mobile-chat">
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
                onBack={handleBackToList}
                isMobile={true}
              />
            )}
            {loadingMessages && (
              <div className="dm-loading-messages">Loading messages…</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop view: show both side by side
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
