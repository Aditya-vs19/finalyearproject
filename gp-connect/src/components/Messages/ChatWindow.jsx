import React, { useEffect, useMemo, useRef } from 'react';
import { BsDot } from 'react-icons/bs';
import MessageInput from './MessageInput.jsx';

const formatTimestamp = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatPresence = (presence) => {
  if (!presence) {
    return 'Offline';
  }
  if (presence.online) {
    return 'Online';
  }
  if (!presence.lastSeen) {
    return 'Offline';
  }
  const lastSeenDate = new Date(presence.lastSeen);
  return `Last seen ${lastSeenDate.toLocaleString()}`;
};

const ChatWindow = ({
  conversation,
  messages,
  presence,
  typing,
  onSend,
  socketConnected,
}) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages?.length, typing]);

  const otherUser = conversation?.otherUser;

  const typingIndicator = useMemo(() => {
    if (!typing) {
      return null;
    }
    return (
      <div className="dm-bubble-wrapper">
        <div className="dm-bubble typing">
          <span className="dm-typing-dot" />
          <span className="dm-typing-dot" />
          <span className="dm-typing-dot" />
        </div>
      </div>
    );
  }, [typing]);

  if (!conversation) {
    return (
      <section className="dm-chat placeholder">
        <div className="dm-chat-placeholder">Select a conversation or start a new one.</div>
      </section>
    );
  }

  return (
    <section className="dm-chat">
      <header className="dm-chat-header">
        <div className="dm-chat-header-content">
          <span className={`dm-header-dot ${presence?.online ? 'online' : ''}`} />
          <div className="dm-header-info">
            <span className="dm-header-name">{otherUser?.fullName || 'Conversation'}</span>
            <span className="dm-header-meta">{formatPresence(presence)}</span>
          </div>
        </div>
      </header>
      <div className="dm-chat-body">
        {messages?.map((message) => (
          <div
            key={message._id}
            className={`dm-bubble-wrapper ${message.isMine ? 'me' : ''}`}
          >
            <div className={`dm-bubble ${message.isMine ? 'me' : 'them'}`}>
              {message.plaintext || 'Encrypted message'}
            </div>
            <div className="dm-bubble-meta">
              <span>{formatTimestamp(message.createdAt)}</span>
              {message.isMine && <BsDot className="dm-bubble-dot" />}
            </div>
          </div>
        ))}
        {typingIndicator}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={onSend} disabled={!socketConnected} />
    </section>
  );
};

export default ChatWindow;
