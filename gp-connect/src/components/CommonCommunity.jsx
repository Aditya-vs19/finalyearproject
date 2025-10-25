import React, { useCallback, useEffect, useRef, useState } from 'react';
import './CommonCommunity.css';
import { communitiesAPI, profileAPI } from '../services/api.js';
import socketService from '../services/socket.js';
import { getProfilePicUrl, handleImageError } from '../utils/imageUtils.js';

const getCommunityImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  // If it's already a full URL (Cloudinary), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // For legacy local images, construct the local URL
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  return `${baseUrl.replace('/api', '')}/uploads/community-images/${imageUrl}`;
};

const MAX_VISIBLE_MEMBERS = 16;

export default function CommonCommunity() {
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [activeCommunity, setActiveCommunity] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [chatError, setChatError] = useState('');
  const [actionCommunityId, setActionCommunityId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const currentUserRef = useRef(null);
  const selectedCommunityIdRef = useRef(null);
  const previousCommunityIdRef = useRef(null);
  const activeCommunityIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  const sortCommunities = useCallback((list) => {
    if (!Array.isArray(list)) {
      return [];
    }

    const cloned = [...list];
    cloned.sort((a, b) => {
      if (a.isAnnouncement && !b.isAnnouncement) return -1;
      if (!a.isAnnouncement && b.isAnnouncement) return 1;
      return a.name.localeCompare(b.name);
    });
    return cloned;
  }, []);

  const handleReturnToList = () => {
    setSelectedCommunityId(null);
    setActiveCommunity(null);
    setMessages([]);
    setChatError('');
    setNewMessage('');
    setSelectedImage(null);
    setImagePreview(null);
  };

  const loadCommunities = async () => {
    try {
      setListLoading(true);
      setListError('');

      const needsUser = !currentUserRef.current;

      if (needsUser) {
        const [userResponse, communitiesResponse] = await Promise.all([
          profileAPI.getCurrentUserProfile(),
          communitiesAPI.listCommunities(),
        ]);

        const userData = userResponse.data.user;
        setCurrentUser(userData);
        currentUserRef.current = userData;

        const communityList = communitiesResponse.data || [];
        setCommunities(sortCommunities(communityList));

        if (!selectedCommunityIdRef.current) {
          const firstJoined = communityList.find((community) => community.isMember);
          if (firstJoined) {
            setSelectedCommunityId(firstJoined._id);
          }
        }
      } else {
        const communitiesResponse = await communitiesAPI.listCommunities();
        const communityList = communitiesResponse.data || [];
        setCommunities(sortCommunities(communityList));
      }
    } catch (error) {
      console.error('Error loading communities:', error);
      setListError(error.response?.data?.message || 'Failed to load communities');
    } finally {
      setListLoading(false);
    }
  };

  const retryActiveCommunity = () => {
    if (!selectedCommunityIdRef.current) {
      return;
    }
    const communityId = selectedCommunityIdRef.current;
    setChatError('');
    setSelectedCommunityId(null);
    setTimeout(() => {
      setSelectedCommunityId(communityId);
    }, 0);
  };

  const handleOpenCommunity = (communityId, isMember) => {
    if (!isMember) {
      return;
    }
    setSelectedCommunityId(communityId);
  };

  const handleJoin = async (communityId) => {
    if (!currentUserRef.current) {
      alert('Please wait while we load your profile...');
      return;
    }

    try {
      setActionCommunityId(communityId);
      const response = await communitiesAPI.joinCommunity(communityId);
      const joinedCommunity = response.data.community;

      setCommunities((prev) =>
        sortCommunities(
          prev.map((community) =>
            community._id === communityId
              ? {
                  ...community,
                  membersCount: joinedCommunity?.membersCount ?? community.membersCount,
                  isMember: true,
                  memberIds: joinedCommunity?.memberIds || community.memberIds,
                }
              : community
          )
        )
      );

      setActiveCommunity((prev) => (prev && prev._id === communityId ? joinedCommunity : prev));
      setMessages([]);
      setSelectedCommunityId(communityId);
    } catch (error) {
      console.error('Error joining community:', error);
      alert(error.response?.data?.message || 'Failed to join community. Please try again.');
    } finally {
      setActionCommunityId(null);
    }
  };

  const handleLeave = async (communityId) => {
    try {
      setActionCommunityId(communityId);
      const response = await communitiesAPI.leaveCommunity(communityId);
      const updatedCommunity = response.data.community;

      setCommunities((prev) =>
        sortCommunities(
          prev.map((community) =>
            community._id === communityId
              ? {
                  ...community,
                  membersCount: updatedCommunity?.membersCount ?? community.membersCount,
                  isMember: false,
                  memberIds: updatedCommunity?.memberIds || community.memberIds,
                }
              : community
          )
        )
      );

      if (selectedCommunityIdRef.current === communityId) {
        handleReturnToList();
      }
    } catch (error) {
      console.error('Error leaving community:', error);
      alert(error.response?.data?.message || 'Failed to leave community. Please try again.');
    } finally {
      setActionCommunityId(null);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size should be less than 5MB');
        event.target.value = ''; // Reset input
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        event.target.value = ''; // Reset input
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.onerror = () => {
        alert('Error reading file');
        setSelectedImage(null);
        setImagePreview(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Reset file input
    const fileInput = document.getElementById('image-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!selectedCommunityId || isSending || !activeCommunity?.canPost) {
      return;
    }

    if (!newMessage.trim() && !selectedImage) {
      return;
    }

    const messageText = newMessage.trim();
    const imageFile = selectedImage;
    
    setNewMessage('');
    setSelectedImage(null);
    setImagePreview(null);

    try {
      setIsSending(true);
      
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        if (messageText) {
          formData.append('content', messageText);
        }
        await communitiesAPI.sendImageMessage(selectedCommunityId, formData);
      } else {
        await communitiesAPI.sendMessage(selectedCommunityId, messageText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
      setSelectedImage(imageFile);
      if (imageFile) {
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(imageFile);
      }
      alert(error.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSocketMessage = (payload) => {
    if (!payload) {
      return;
    }

    const { communityId, message } = payload;
    if (!communityId || !message) {
      return;
    }

    setCommunities((prev) =>
      sortCommunities(
        prev.map((community) =>
          community._id === communityId
            ? { ...community, lastActivityAt: message.timestamp }
            : community
        )
      )
    );

    if (activeCommunityIdRef.current === communityId) {
      setMessages((prev) => [...prev, message]);
    }
  };

  const handleSocketMemberUpdate = (payload) => {
    if (!payload) {
      return;
    }

    const { communityId, membersCount, members } = payload;
    if (!communityId) {
      return;
    }

    const currentUserId = currentUserRef.current?._id;
    const memberIdsFromPayload = Array.isArray(payload.memberIds)
      ? payload.memberIds.map((id) => id.toString())
      : null;

    setCommunities((prev) =>
      sortCommunities(
        prev.map((community) => {
        if (community._id !== communityId) {
          return community;
        }

        const updatedIsMember =
          memberIdsFromPayload && currentUserId
            ? memberIdsFromPayload.includes(currentUserId)
            : Array.isArray(members) && currentUserId
              ? members.some((member) => {
                  const memberId = member?._id || member;
                  return memberId && memberId.toString() === currentUserId;
                })
              : community.isMember;

        return {
          ...community,
          membersCount: typeof membersCount === 'number' ? membersCount : community.membersCount,
          isMember: updatedIsMember,
        };
        })
      )
    );

    if (activeCommunityIdRef.current === communityId) {
      setActiveCommunity((prev) => {
        if (!prev) {
          return prev;
        }

        const updatedMembers = Array.isArray(members) ? members : prev.members;
        const updatedMemberIds = memberIdsFromPayload || prev.memberIds;
        let updatedIsMember = prev.isMember;

        if (memberIdsFromPayload && currentUserId) {
          updatedIsMember = memberIdsFromPayload.includes(currentUserId);
        } else if (Array.isArray(members) && currentUserId) {
          updatedIsMember = members.some((member) => {
            const memberId = member?._id || member;
            return memberId && memberId.toString() === currentUserId;
          });
        }

        return {
          ...prev,
          membersCount: typeof membersCount === 'number' ? membersCount : prev.membersCount,
          members: updatedMembers,
          memberIds: updatedMemberIds,
          isMember: updatedIsMember,
        };
      });
    }
  };

  const handleSocketMetaUpdate = (payload) => {
    if (!payload) {
      return;
    }

    const { communityId, membersCount } = payload;
    if (!communityId) {
      return;
    }

    setCommunities((prev) =>
      sortCommunities(
        prev.map((community) =>
          community._id === communityId
            ? {
                ...community,
                membersCount: typeof membersCount === 'number' ? membersCount : community.membersCount,
              }
            : community
        )
      )
    );
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  useEffect(() => {
    socketService.connect();

    return () => {
      if (previousCommunityIdRef.current) {
        socketService.leaveCommunity(previousCommunityIdRef.current);
      }
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    selectedCommunityIdRef.current = selectedCommunityId;
    activeCommunityIdRef.current = selectedCommunityId;
  }, [selectedCommunityId]);

  useEffect(() => {
    const previousId = previousCommunityIdRef.current;

    if (previousId && previousId !== selectedCommunityId) {
      socketService.leaveCommunity(previousId);
    }

    if (selectedCommunityId) {
      socketService.joinCommunity(selectedCommunityId);
    }

    previousCommunityIdRef.current = selectedCommunityId;
  }, [selectedCommunityId]);

  useEffect(() => {
    let isCancelled = false;

    const loadActiveCommunity = async () => {
      if (!selectedCommunityId) {
        setActiveCommunity(null);
        setMessages([]);
        setChatError('');
        return;
      }

      setChatLoading(true);
      setChatError('');

      try {
        const [communityResponse, messagesResponse] = await Promise.all([
          communitiesAPI.getCommunity(selectedCommunityId),
          communitiesAPI.getCommunityMessages(selectedCommunityId),
        ]);

        if (isCancelled) {
          return;
        }

        const communityData = communityResponse.data;
        const messageList = messagesResponse.data || [];

        setActiveCommunity(communityData);
        activeCommunityIdRef.current = communityData?._id;
        setMessages(messageList);

        setCommunities((prev) =>
          prev.map((community) =>
            community._id === communityData._id
              ? {
                  ...community,
                  membersCount: communityData.membersCount,
                  isMember: communityData.isMember,
                  isAnnouncement: communityData.isAnnouncement,
                }
              : community
          )
        );
      } catch (error) {
        if (!isCancelled) {
          console.error('Error loading community data:', error);
          setChatError(error.response?.data?.message || 'Failed to load community');
        }
      } finally {
        if (!isCancelled) {
          setChatLoading(false);
        }
      }
    };

    loadActiveCommunity();

    return () => {
      isCancelled = true;
    };
  }, [selectedCommunityId]);

  useEffect(() => {
    socketService.onNewMessage(handleSocketMessage);
    socketService.onMemberUpdate(handleSocketMemberUpdate);
    socketService.onCommunityMetaUpdate(handleSocketMetaUpdate);

    return () => {
      socketService.offNewMessage(handleSocketMessage);
      socketService.offMemberUpdate(handleSocketMemberUpdate);
      socketService.offCommunityMetaUpdate(handleSocketMetaUpdate);
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const renderCommunitiesList = () => (
    <div className="common-community">
      <div className="communities-wrapper">
        <div className="communities-header">
          <h1>Communities</h1>
          <p>Select a department community to collaborate or view the latest campus announcements.</p>
        </div>
        {communities.length === 0 ? (
          <div className="no-communities">
            <p>No communities are available yet. Please check back later.</p>
          </div>
        ) : (
          <div className="communities-grid">
            {communities.map((community) => {
              const isActionPending = actionCommunityId === community._id;
              const cardClasses = ['community-card'];
              if (community.isMember) {
                cardClasses.push('community-card-member');
              }
              if (community.isAnnouncement) {
                cardClasses.push('community-card-announcement');
              }
              return (
                <div
                  key={community._id}
                  className={cardClasses.join(' ')}
                  onClick={() => handleOpenCommunity(community._id, community.isMember)}
                >
                  <div className="community-card-header">
                    <div className="community-avatar-large">{community.avatar}</div>
                    <div className="community-card-info">
                      <div className="community-title-row">
                        <h2>{community.name}</h2>
                        <div className="community-badges">
                          {community.isAnnouncement && <span className="official-badge">Official</span>}
                          {community.adminOnly && <span className="admin-only-badge">Admin Only</span>}
                          {community.userIsAdmin && <span className="user-admin-badge">You're Admin</span>}
                        </div>
                      </div>
                      <p>{community.description}</p>
                      {community.departmentRestriction && !community.isUnrestricted && (
                        <div className="department-restriction">
                          <span className="restriction-icon">🏛️</span>
                          <span className="restriction-text">
                            {community.departmentInfo?.departmentMatch 
                              ? `${community.departmentRestriction} Department` 
                              : `Restricted to ${community.departmentRestriction} Department`}
                          </span>
                          {!community.departmentInfo?.departmentMatch && (
                            <span className="restriction-status not-eligible">Not Eligible</span>
                          )}
                        </div>
                      )}
                      {community.helpMessage && (
                        <div className="help-message">
                          <span className="help-icon">ℹ️</span>
                          <span>{community.helpMessage}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="community-card-footer">
                    <span className="member-count">{community.membersCount || 0} members</span>
                    {community.isMember ? (
                      <div className="community-card-actions">
                        <button
                          className="view-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenCommunity(community._id, true);
                          }}
                        >
                          Enter
                        </button>
                        <button
                          className="leave-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleLeave(community._id);
                          }}
                          disabled={isActionPending}
                        >
                          {isActionPending ? 'Leaving...' : 'Leave'}
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`join-btn ${!community.canJoin ? 'join-btn-disabled' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (community.canJoin) {
                            handleJoin(community._id);
                          } else {
                            alert(community.helpMessage || 'You cannot join this community');
                          }
                        }}
                        disabled={isActionPending || !community.canJoin}
                        title={community.canJoin ? 'Join this community' : community.helpMessage}
                      >
                        {isActionPending ? 'Joining...' : 
                         !community.canJoin ? 'Restricted' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderChat = () => {
    if (chatError) {
      return (
        <div className="common-community">
          <div className="error-container">
            <h2>Unable to load community</h2>
            <p>{chatError}</p>
            <div className="error-actions">
              <button className="retry-btn" onClick={retryActiveCommunity}>Retry</button>
              <button className="secondary-btn" onClick={handleReturnToList}>Back to communities</button>
            </div>
          </div>
        </div>
      );
    }

    const visibleMembers = (activeCommunity?.members || []).slice(0, MAX_VISIBLE_MEMBERS);
    const remainingMembers = Math.max(
      0,
      (activeCommunity?.membersCount || 0) - visibleMembers.length
    );

    return (
      <div className="common-community">
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-info">
              <div className="community-avatar">{activeCommunity?.avatar || '🌐'}</div>
              <div>
                <h2 className="chat-title">{activeCommunity?.name || 'Loading...'}</h2>
                {activeCommunity?.isAnnouncement && (
                  <p className="chat-subtitle">Official channel · Admin posts only</p>
                )}
                <p className="member-count">{activeCommunity?.membersCount || 0} members</p>
              </div>
            </div>
            <div className="chat-actions">
              <button className="back-btn" onClick={handleReturnToList}>
                Browse Communities
              </button>
              <button
                className="leave-btn"
                onClick={() => handleLeave(selectedCommunityId)}
                disabled={actionCommunityId === selectedCommunityId}
              >
                {actionCommunityId === selectedCommunityId ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>

          {chatLoading && (
            <div className="chat-loading-container">
              <div className="loading-spinner"></div>
              <p>Loading community...</p>
            </div>
          )}

          {!chatLoading && visibleMembers.length > 0 && (
            <div className="community-members-strip">
              <span className="strip-label">Members</span>
              <div className="strip-list">
                {visibleMembers.map((member) => (
                  <div key={member._id} className="strip-member">
                    <div className="strip-member-avatar">
                      {member.profilePic ? (
                        <img
                          src={getProfilePicUrl(member.profilePic)}
                          alt={member.fullName || 'Community member'}
                          onError={(event) => handleImageError(event)}
                        />
                      ) : (
                        <span className="strip-member-fallback">
                          {member.fullName ? member.fullName.charAt(0) : '?'}
                        </span>
                      )}
                      {member.isAdmin && <span className="member-admin-badge">👑</span>}
                    </div>
                    <span className="strip-member-name">
                      {member.fullName || 'Member'}
                      {member.isAdmin && <span className="admin-indicator"> (Admin)</span>}
                    </span>
                  </div>
                ))}
                {remainingMembers > 0 && (
                  <div className="strip-member more-members">+{remainingMembers}</div>
                )}
              </div>
            </div>
          )}

          {activeCommunity?.isAnnouncement && !activeCommunity?.canPost && (
            <div className="announcement-banner">
              🔔 Only the admin can share official announcements in this community.
            </div>
          )}

          <div className="messages-container">
            <div className="messages-list">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <div className="welcome-icon">💬</div>
                  <h3>
                    {activeCommunity?.name ? `Welcome to ${activeCommunity.name}!` : 'Welcome!'}
                  </h3>
                  <p>
                    {activeCommunity?.isAnnouncement
                      ? 'Stay tuned for the latest announcements.'
                      : 'Start the conversation by sending a message below.'}
                  </p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const senderId = message.sender?._id;
                  const isOwnMessage = senderId && senderId === currentUser?._id;
                  const previousSenderId = messages[index - 1]?.sender?._id;
                  const showAvatar = index === 0 || previousSenderId !== senderId;

                  return (
                    <div
                      key={message._id || `${message.timestamp}-${index}`}
                      className={`message-wrapper ${isOwnMessage ? 'own-message' : 'other-message'}`}
                    >
                      {!isOwnMessage && showAvatar && (
                        <div className="message-avatar">
                          {message.sender?.profilePic ? (
                            <img
                              src={getProfilePicUrl(message.sender.profilePic)}
                              alt={message.sender?.fullName || 'Community member'}
                              onError={(event) => handleImageError(event)}
                            />
                          ) : (
                            <span>{message.sender?.fullName?.charAt(0) || '?'}</span>
                          )}
                        </div>
                      )}
                      {!isOwnMessage && !showAvatar && <div className="message-spacer"></div>}

                      <div className="message-bubble">
                        {!isOwnMessage && showAvatar && (
                          <div className="message-sender">
                            {message.sender?.fullName || 'Unknown user'}
                            {message.sender?.isAdmin && <span className="sender-admin-badge">👑</span>}
                          </div>
                        )}
                        <div className="message-content">
                          {message.messageType === 'image' && message.image && (
                            <div className="message-image">
                              <img 
                                src={getCommunityImageUrl(message.image)}
                                alt="Shared image"
                                onClick={() => window.open(getCommunityImageUrl(message.image), '_blank')}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          {message.content && (
                            <div className="message-text">{message.content}</div>
                          )}
                          <div className="message-time">{formatTime(message.timestamp)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="message-input-container">
            {imagePreview && (
              <div className="image-preview-container">
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button 
                    type="button" 
                    className="remove-image-btn"
                    onClick={handleRemoveImage}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="message-form">
              <div className="message-input-wrapper">
                <input
                  type="text"
                  placeholder={
                    activeCommunity?.isAnnouncement && !activeCommunity?.canPost
                      ? 'Only admin can post announcements.'
                      : 'Type a message...'
                  }
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  disabled={isSending || !activeCommunity?.canPost}
                  className={`message-input${!activeCommunity?.canPost ? ' message-input-disabled' : ''}`}
                />
                {activeCommunity?.canPost && !activeCommunity?.isAnnouncement && (
                  <div className="message-actions">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      disabled={isSending}
                      style={{ display: 'none' }}
                      id="image-upload"
                    />
                    <label 
                      htmlFor="image-upload" 
                      className={`image-upload-btn ${isSending ? 'disabled' : ''}`}
                      title="Add image"
                    >
                      📷
                    </label>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={
                  isSending || (!newMessage.trim() && !selectedImage) || !activeCommunity?.canPost
                }
                className="send-btn"
              >
                {isSending ? <div className="sending-spinner"></div> : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  if (listLoading) {
    return (
      <div className="common-community">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading communities...</p>
        </div>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="common-community">
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{listError}</p>
          <button className="retry-btn" onClick={loadCommunities}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (selectedCommunityId) {
    return renderChat();
  }

  return renderCommunitiesList();
}
