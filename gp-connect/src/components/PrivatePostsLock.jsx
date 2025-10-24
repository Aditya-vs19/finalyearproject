import React from 'react';
import { FaLock } from 'react-icons/fa';
import './PrivatePostsLock.css';

const PrivatePostsLock = ({ targetUser, onFollowClick, isFollowLoading }) => {
  const userName = targetUser?.fullName || 'this user';
  
  return (
    <div className="private-posts-lock" role="region" aria-label="Private posts section">
      <div className="lock-content">
        <div className="lock-icon-container">
          <FaLock className="lock-icon" aria-hidden="true" />
        </div>
        
        <div className="lock-message">
          <h3>Posts are private</h3>
          <p>Follow {userName} to see their posts</p>
        </div>
        
        <button
          className="follow-unlock-btn"
          onClick={onFollowClick}
          disabled={isFollowLoading}
          aria-label={`Follow ${userName} to see their posts`}
          type="button"
        >
          {isFollowLoading ? 'Following...' : `Follow ${userName}`}
        </button>
      </div>
    </div>
  );
};

export default PrivatePostsLock;