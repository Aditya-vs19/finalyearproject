import React, { useState, useEffect } from 'react';
import './Feed.css';
import { postsAPI } from '../services/api';
import { getProfilePicUrl, getPostImageUrl, handleImageError } from '../utils/imageUtils.js';
import socketService from '../services/socket.js';

export const getFeeds = async () => {
  try {
    const response = await postsAPI.getPosts();
    console.log('📡 API Response:', response);
    console.log('📦 Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching feeds:', error);
    console.error('Error details:', error.response?.data || error.message);
    return [];
  }
};

export default function Feed({ onNavigateToProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [postStates, setPostStates] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  // Debug: Track posts changes
  useEffect(() => {
    console.log('🔄 Posts state changed. New length:', posts.length);
    console.log('📝 Current posts:', posts);
  }, [posts]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch current user first
        let currentUserData = null;
        const currentUserResponse = await fetch('http://localhost:5000/api/profile/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (currentUserResponse.ok) {
          const userData = await currentUserResponse.json();
          currentUserData = userData.user;
          setCurrentUser(currentUserData);
        }
        
        // Fetch posts
        const fetchedPosts = await getFeeds();
        console.log('🔍 Fetched posts:', fetchedPosts);
        console.log('📊 Number of posts:', fetchedPosts.length);
        console.log('👤 Current user ID:', currentUserData?._id);
        setPosts(fetchedPosts);
        
        // Initialize post states for each post with real data
        const initialStates = {};
        const currentUserId = currentUserData?._id; // Use the freshly fetched data, not state
        fetchedPosts.forEach(post => {
          // Check if current user has liked this post
          const isLiked = currentUserId && post.likes && post.likes.some(like => {
            if (typeof like === 'object' && like._id) {
              return like._id === currentUserId;
            } else if (typeof like === 'string') {
              return like === currentUserId;
            }
            return false;
          });
          
          initialStates[post._id] = {
            liked: isLiked || false,
            likes: post.likesCount || 0,
            comments: post.comments || [],
            showComments: false,
            commentText: ''
          };
        });
        setPostStates(initialStates);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load posts. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Socket.IO for real-time like and comment updates
  useEffect(() => {
    const handleLikeUpdate = (data) => {
      const { postId, userId, liked, likesCount, likes } = data;
      
      // Update post states
      setPostStates(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          liked: liked,
          likes: likesCount
        }
      }));

      // Update posts array
      setPosts(prev => prev.map(post => 
        post._id === postId 
          ? { ...post, likes: likes, likesCount: likesCount }
          : post
      ));
    };

    const handleCommentUpdate = (data) => {
      const { postId, comment, commentsCount } = data;
      
      // Update post states
      setPostStates(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: [...(prev[postId]?.comments || []), comment]
        }
      }));

      // Update posts array
      setPosts(prev => prev.map(post => 
        post._id === postId 
          ? { ...post, comments: [...(post.comments || []), comment], commentsCount: commentsCount }
          : post
      ));
    };

    // Connect to socket and listen for updates
    socketService.connect();
    socketService.onPostLikeUpdate(handleLikeUpdate);
    socketService.onPostCommentUpdate(handleCommentUpdate);

    return () => {
      socketService.offPostLikeUpdate(handleLikeUpdate);
      socketService.offPostCommentUpdate(handleCommentUpdate);
    };
  }, []);

  const handleUsernameClick = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (onNavigateToProfile) {
          onNavigateToProfile(data.user);
        }
      } else {
        console.error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await postsAPI.toggleLike(postId);
      const { liked, likesCount, likes } = response.data;
      
      setPostStates(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          liked: liked,
          likes: likesCount
        }
      }));

      // Update the post in the posts array with real like data
      setPosts(prev => prev.map(post => 
        post._id === postId 
          ? { ...post, likes: likes, likesCount: likesCount }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = (postId) => {
    setPostStates(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        showComments: !prev[postId].showComments
      }
    }));
  };

  const handleAddComment = async (postId) => {
    const commentText = postStates[postId].commentText.trim();
    if (commentText) {
      try {
        const response = await postsAPI.addComment(postId, commentText);
        const { comment, commentsCount } = response.data;
        
        // Update post states with the new comment
        setPostStates(prev => ({
          ...prev,
          [postId]: {
            ...prev[postId],
            comments: [...prev[postId].comments, comment],
            commentText: ''
          }
        }));

        // Update the post in the posts array
        setPosts(prev => prev.map(post => 
          post._id === postId 
            ? { ...post, comments: [...post.comments, comment], commentsCount: commentsCount }
            : post
        ));
      } catch (error) {
        console.error('Error adding comment:', error);
      }
    }
  };

  const handleCommentChange = (postId, value) => {
    setPostStates(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        commentText: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="posts-container">
        <div style={{ textAlign: 'center', padding: '2rem', color: '#ffffff' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #333',
            borderTop: '4px solid #ffffff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading posts...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="posts-container">
        <div style={{ textAlign: 'center', padding: '2rem', color: '#ff6b6b' }}>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: '#5C8DC5',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="posts-container">
        <div style={{ textAlign: 'center', padding: '2rem', color: '#ffffff' }}>
          <p>No posts in your feed yet.</p>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
            Follow some users or create your first post to see content here!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="posts-container">
      {posts.map((post) => {
        const postState = postStates[post._id];
        const user = post.userId || post.user;
        
        return (
          <div key={post._id} className="post-card">
            <div className="post-header">
              <div className="avatar">
                {user.profilePic ? (
                  <img 
                    src={getProfilePicUrl(user.profilePic)} 
                    alt="Profile" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onError={(e) => handleImageError(e, '/default-avatar.svg')}
                  />
                ) : null}
                <span style={{ display: user.profilePic ? 'none' : 'block' }}>
                  {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                </span>
              </div>
              <span 
                className="username clickable-username" 
                onClick={() => handleUsernameClick(user._id)}
                title={`Click to view ${user.fullName}'s profile`}
              >
                {user.fullName}
              </span>
            </div>
            {post.image && (
              <img 
                src={getPostImageUrl(post.image)} 
                alt={post.caption} 
                className="post-img"
                onError={(e) => handleImageError(e, 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+')}
              />
            )}
            <div className="post-body">
              <p>
                <span 
                  className="username clickable-username" 
                  onClick={() => handleUsernameClick(user._id)}
                  title={`Click to view ${user.fullName}'s profile`}
                >
                  {user.fullName}
                </span> {post.caption}
              </p>
              
              {/* Like count with who liked */}
              <div className="like-count">
                {postState.likes} {postState.likes === 1 ? 'like' : 'likes'}
                {post.likes && post.likes.length > 0 && (
                  <div className="liked-by">
                    {post.likes.slice(0, 3).map((like, index) => (
                      <span key={index} className="liked-user">
                        {typeof like === 'string' ? like : like.fullName}
                        {index < Math.min(post.likes.length, 3) - 1 && ', '}
                      </span>
                    ))}
                    {post.likes.length > 3 && (
                      <span className="more-likes"> and {post.likes.length - 3} others</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Comments section */}
              {postState.showComments && (
                <div className="comments-section">
                  {postState.comments.map((comment, index) => (
                    <div key={comment._id || index} className="comment">
                      <span className="comment-username">
                        {typeof comment.user === 'object' ? comment.user.fullName : 'User'}
                      </span>
                      <span className="comment-text">{comment.text}</span>
                    </div>
                  ))}
                  <div className="add-comment">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={postState.commentText}
                      onChange={(e) => handleCommentChange(post._id, e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                      className="comment-input"
                    />
                    <button 
                      onClick={() => handleAddComment(post._id)}
                      className="comment-button"
                      disabled={!postState.commentText.trim()}
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
              
              <div className="post-actions">
                <span 
                  role="img" 
                  aria-label="like"
                  className={`like-button ${postState.liked ? 'liked' : ''}`}
                  onClick={() => handleLike(post._id)}
                >
                  {postState.liked ? '❤️' : '🤍'}
                </span>
                <span 
                  role="img" 
                  aria-label="comment"
                  className="comment-button-icon"
                  onClick={() => handleComment(post._id)}
                >
                  💬 {post.commentsCount || 0}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
