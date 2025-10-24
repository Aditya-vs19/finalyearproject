import React, { useMemo, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useChat } from './ChatProvider.jsx';
import { decryptMessage } from '../../utils/chatEncryption.js';

const getConversationPreview = (conversation) => {
  if (!conversation?.lastMessage) {
    return 'No messages yet';
  }
  const text = decryptMessage(conversation.lastMessage).trim();
  if (!text) {
    return 'Encrypted message';
  }
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
};

const getInitial = (fullName = '') => fullName?.trim()?.charAt(0)?.toUpperCase() || '?';

const ConversationsList = ({ onSelectConversation, onSelectUser }) => {
  const {
    conversations,
    activeConversationId,
    socketConnected,
    typingMap,
    presenceMap,
    followingUsers,
  } = useChat();

  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredFollowing = useMemo(() => {
    if (!normalizedSearch) {
      return [];
    }
    return followingUsers.filter((user) =>
      user.fullName?.toLowerCase().includes(normalizedSearch) ||
      user.enrollment?.toLowerCase().includes(normalizedSearch)
    );
  }, [followingUsers, normalizedSearch]);

  return (
    <aside className="dm-list">
      <div className="dm-title-row">
        <h4 className="dm-title">Messages</h4>
        <span className={`dm-connection-status ${socketConnected ? 'online' : 'offline'}`}>
          {socketConnected ? 'Connected' : 'Offline'}
        </span>
      </div>
      <label className="dm-search" htmlFor="chat-search">
        <span className="dm-search-icon">
          <IoSearch />
        </span>
        <input
          id="chat-search"
          type="search"
          className="dm-search-input"
          placeholder="Search following…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </label>
      {normalizedSearch && (
        <div className="dm-search-results">
          <div className="dm-search-results-header">Search Results</div>
          {filteredFollowing.length === 0 && (
            <div className="dm-search-hint">No followed users match that search.</div>
          )}
          {filteredFollowing.map((user) => (
            <button
              key={user._id}
              type="button"
              className="dm-search-result"
              onClick={() => onSelectUser(user._id)}
            >
              <span className="dm-search-avatar">{getInitial(user.fullName)}</span>
              <span className="dm-search-name">{user.fullName}</span>
            </button>
          ))}
        </div>
      )}
      <div className="dm-conversation-list">
        {conversations.length > 0 && (
          <div className="dm-conversations-header">Recent Conversations</div>
        )}
        {conversations.length === 0 && !normalizedSearch && (
          <div className="dm-search-hint">Start a conversation with someone you follow.</div>
        )}
        {conversations.map((conversation) => {
          const other = conversation.otherUser;
          const isSelected = conversation._id === activeConversationId;
          const presence = other?._id ? presenceMap[other._id] : null;
          const preview = typingMap[conversation._id]
            ? 'Typing…'
            : getConversationPreview(conversation);
          return (
            <button
              key={conversation._id}
              type="button"
              className={`msg-item${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectConversation(conversation._id)}
            >
              <div className="msg-avatar">
                {getInitial(other?.fullName)}
                <span className={`msg-presence ${presence?.online ? 'online' : 'offline'}`} />
              </div>
              <div className="msg-content">
                <p className="msg-name">{other?.fullName || 'Unknown user'}</p>
                <p className="msg-preview">{preview}</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ConversationsList;
