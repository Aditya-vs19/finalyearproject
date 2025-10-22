import React, { useState, useEffect } from 'react';
import Feed from './Feed';
import MessagePanel from './MessagePanel';
import ProfilePage from './ProfilePage';
import NotificationPage from './NotificationPage';
import CommonCommunity from './CommonCommunity';
import SettingsPage from './SettingsPage';
import CreatePage from './CreatePage';
import ParticleBackground from './ParticleBackground';
import './HomePage.css';
import { FaHome, FaBell, FaEnvelope, FaUser, FaCog, FaSignOutAlt, FaSearch, FaUsers, FaPlus, FaArrowLeft } from 'react-icons/fa';
import { profileAPI } from '../services/api';
import { getProfilePicUrl, handleImageError } from '../utils/imageUtils.js';

export default function HomePage({ onLogout }) {
  const [showSettings, setShowSettings] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);
  const [viewingUserProfile, setViewingUserProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [topSearchResults, setTopSearchResults] = useState([]);
  const [showTopSearchDropdown, setShowTopSearchDropdown] = useState(false);
  const [isTopSearching, setIsTopSearching] = useState(false);
  const [pendingChatUserId, setPendingChatUserId] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 700);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await profileAPI.getCurrentUserProfile();
        setCurrentUser(response.data.user);
      } catch (error) {
        console.error('Error fetching current user:', error);
        // If there's an authentication error, redirect to login
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.reload();
        }
      }
    };

    fetchCurrentUser();
  }, []);

  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    
    // Clear previous timeout
    if (window.searchTimeout) {
      clearTimeout(window.searchTimeout);
    }
    
    if (query.trim().length >= 2) {
      // Debounce the search to avoid too many API calls
      window.searchTimeout = setTimeout(async () => {
        setIsTopSearching(true);
        try {
          const response = await profileAPI.searchUsers(query.trim());
          setTopSearchResults(response.data || []);
          setShowTopSearchDropdown(true);
        } catch (error) {
          console.error('Search error:', error);
          setTopSearchResults([]);
          setShowTopSearchDropdown(false);
        } finally {
          setIsTopSearching(false);
        }
      }, 300); // 300ms delay
    } else {
      setTopSearchResults([]);
      setShowTopSearchDropdown(false);
    }
  };

  const handleTopSearchUserClick = async (user) => {
    try {
      const response = await profileAPI.getUserProfile(user._id);
      setViewingUserProfile(response.data.user);
      setActiveTab('profile');
      setShowTopSearchDropdown(false);
      setSearchTerm('');
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleTopSearchFollowToggle = async (userId, isCurrentlyFollowing) => {
    try {
      if (isCurrentlyFollowing) {
        await profileAPI.unfollowUser(userId);
      } else {
        await profileAPI.followUser(userId);
      }
      
      // Update the search results to reflect the change
      setTopSearchResults(prev => 
        prev.map(user => 
          user._id === userId 
            ? { ...user, isFollowing: !isCurrentlyFollowing }
            : user
        )
      );
    } catch (error) {
      console.error('Follow/unfollow error:', error);
    }
  };

  // Test function to check database connection
  const testDatabase = async () => {
    try {
      console.log('Testing database connection...');
      const response = await profileAPI.testUsers();
      console.log('Database test result:', response.data);
      alert(`Database test successful! Found ${response.data.totalUsers} users in database.`);
    } catch (error) {
      console.error('Database test error:', error);
      alert('Database test failed: ' + (error.response?.data?.message || error.message));
    }
  };

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-bar-wrapper')) {
        setShowTopSearchDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleNavigateToProfile = (userProfileData) => {
    setViewingUserProfile(userProfileData);
    setActiveTab('profile');
  };

  const handleBackToHome = () => {
    setViewingUserProfile(null);
    setActiveTab('home');
  };

  const handleNavigateToMyProfile = () => {
    setViewingUserProfile(null);
    setActiveTab('profile');
  };

  const openMessages = (userId = null) => {
    setPendingChatUserId(userId);
    setActiveTab('messages');
  };

  const handleStartChatFromProfile = (userId) => {
    if (!userId) {
      return;
    }
    openMessages(userId);
  };

  // Search component for mobile
  const SearchComponent = () => {
    const [searchResults, setSearchResults] = useState([]);
    const [localSearchTerm, setLocalSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    // Real-time search as user types
    const handleSearchChange = async (e) => {
      const query = e.target.value;
      setLocalSearchTerm(query);
      
      // Clear previous timeout
      if (window.searchTabTimeout) {
        clearTimeout(window.searchTabTimeout);
      }
      
      if (query.trim().length >= 2) {
        setHasSearched(true);
        setIsSearching(true);
        setSearchError('');
        
        // Debounce the search
        window.searchTabTimeout = setTimeout(async () => {
          try {
            const response = await profileAPI.searchUsers(query.trim());
            setSearchResults(response.data || []);
          } catch (error) {
            console.error('Search error:', error);
            setSearchError('Failed to search users. Please try again.');
            setSearchResults([]);
          } finally {
            setIsSearching(false);
          }
        }, 300);
      } else {
        setSearchResults([]);
        setHasSearched(false);
        setSearchError('');
      }
    };

    const handleSearch = async (e) => {
      e.preventDefault();
      if (localSearchTerm.trim().length < 2) {
        setSearchError('Search query must be at least 2 characters long');
        return;
      }

      setIsSearching(true);
      setSearchError('');
      setHasSearched(true);
      
      try {
        const response = await profileAPI.searchUsers(localSearchTerm.trim());
        setSearchResults(response.data || []);
      } catch (error) {
        console.error('Search error:', error);
        setSearchError('Failed to search users. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const handleFollowToggle = async (userId, isCurrentlyFollowing) => {
      try {
        if (isCurrentlyFollowing) {
          await profileAPI.unfollowUser(userId);
        } else {
          await profileAPI.followUser(userId);
        }
        
        // Update the search results to reflect the change
        setSearchResults(prev => 
          prev.map(user => 
            user._id === userId 
              ? { ...user, isFollowing: !isCurrentlyFollowing }
              : user
          )
        );
      } catch (error) {
        console.error('Follow/unfollow error:', error);
        alert('Failed to update follow status. Please try again.');
      }
    };

    const handleUserClick = async (user) => {
      try {
        const response = await profileAPI.getUserProfile(user._id);
        handleNavigateToProfile(response.data.user);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        alert('Failed to load user profile. Please try again.');
      }
    };

    return (
      <div className="search-page">
        <div className="search-header">
          <button className="mobile-back-btn" onClick={() => setActiveTab('home')}>
            <FaArrowLeft />
          </button>
          <h2>Search</h2>
          <button 
            onClick={testDatabase}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test DB
          </button>
        </div>

        <div className="search-form">
          <div className="search-input-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by name or enrollment..."
              value={localSearchTerm}
              onChange={handleSearchChange}
            />
            {localSearchTerm && (
              <button 
                className="clear-search-btn"
                onClick={() => {
                  setLocalSearchTerm('');
                  setSearchResults([]);
                  setHasSearched(false);
                  setSearchError('');
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {searchError && (
          <div className="search-error">
            <p>{searchError}</p>
          </div>
        )}

        {isSearching && (
          <div className="search-loading-container">
            <div className="search-spinner"></div>
            <span>Searching...</span>
          </div>
        )}

        {!isSearching && hasSearched && searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(user => (
              <div key={user._id} className="search-result-user-card">
                <div className="search-user-avatar-section" onClick={() => handleUserClick(user)}>
                  <img
                    src={getProfilePicUrl(user.profilePic)}
                    alt="Profile"
                    className="search-user-avatar-img"
                    onError={(e) => handleImageError(e, '/default-avatar.svg')}
                  />
                </div>
                <div className="search-user-details" onClick={() => handleUserClick(user)}>
                  <div className="search-username">@{user.enrollment}</div>
                  <div className="search-fullname">{user.fullName}</div>
                  <div className="search-department">{user.department} Department</div>
                  {user.isFollowing && (
                    <div className="followed-by">Followed by you</div>
                  )}
                </div>
                <div className="search-user-actions">
                  <button
                    className={`search-follow-button ${user.isFollowing ? 'following' : 'follow'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollowToggle(user._id, user.isFollowing);
                    }}
                  >
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
          <div className="no-results">
            <p>No users found for "{localSearchTerm}"</p>
          </div>
        )}

        {!hasSearched && localSearchTerm.length === 0 && (
          <div className="search-placeholder">
            <p>Search for users by name or enrollment number</p>
          </div>
        )}
      </div>
    );
  };

  // Footer nav for mobile
  const MobileFooter = () => (
    <footer className="mobile-footer-nav">
      <button className={`footer-tab${activeTab === 'home' ? ' active' : ''}`} onClick={() => setActiveTab('home')}><FaHome /></button>
      <button className={`footer-tab${activeTab === 'communities' ? ' active' : ''}`} onClick={() => setActiveTab('communities')}><FaUsers /></button>
      <button className={`footer-tab${activeTab === 'create' ? ' active' : ''}`} onClick={() => setActiveTab('create')}><FaPlus /></button>
      <button className="footer-tab search-tab" onClick={() => setActiveTab('search')}><FaSearch /></button>
      <button className={`footer-tab${activeTab === 'profile' ? ' active' : ''}`} onClick={handleNavigateToMyProfile}><FaUser /></button>
    </footer>
  );

  return (
    <div className="home">
      <ParticleBackground />
      <header className={`navbar-glass${isMobile ? ' mobile-header' : ''}`}> 
        <div className="left-section">
          <h1 className="brand-gradient">GP‑ConnecX</h1>
        </div>
        <div className="center-section">
          <div className="search-bar-wrapper">
            <input
              type="text"
              className="search-bar"
              placeholder="Search users by name or enrollment..."
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => {
                if (topSearchResults.length > 0) {
                  setShowTopSearchDropdown(true);
                }
              }}
            />
            
            {/* Search Dropdown */}
            {showTopSearchDropdown && (
              <div className="search-dropdown">
                {isTopSearching ? (
                  <div className="search-loading">
                    <div className="search-spinner"></div>
                    <span>Searching...</span>
                  </div>
                ) : topSearchResults.length > 0 ? (
                  <div className="search-results-list">
                    {topSearchResults.map(user => (
                      <div 
                        key={user._id} 
                        className="search-result-user"
                        onClick={() => handleTopSearchUserClick(user)}
                      >
                        <div className="search-user-avatar">
                          <img
                            src={getProfilePicUrl(user.profilePic)}
                            alt="Profile"
                            onError={(e) => handleImageError(e, '/default-avatar.svg')}
                          />
                        </div>
                        <div className="search-user-info">
                          <div className="search-user-name">{user.fullName}</div>
                          <div className="search-user-enrollment">@{user.enrollment}</div>
                          <div className="search-user-department">{user.department} Department</div>
                        </div>
                        <button
                          className={`search-follow-btn ${user.isFollowing ? 'following' : 'follow'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTopSearchFollowToggle(user._id, user.isFollowing);
                          }}
                        >
                          {user.isFollowing ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : searchTerm.trim().length >= 2 ? (
                  <div className="search-no-results">
                    <span>No users found for "{searchTerm}"</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="right-section nav-actions">
          <button className="icon-btn" onClick={() => setActiveTab('notifications')} title="Notifications">
            <FaBell />
          </button>
          <button
            className="icon-btn"
            onClick={() => openMessages()}
            title="Messages"
          >
            <FaEnvelope />
          </button>
        </div>
      </header>
      <div className="layout">
        {!isMobile && (
          <aside className="sidebar">
            <nav className="sidebar-nav">
              <button className={`sidebar-tab${activeTab === 'home' ? ' active' : ''}`} onClick={() => setActiveTab('home')}>
                <FaHome className="sidebar-icon" /> <span>Home</span>
              </button>
              <button className={`sidebar-tab${activeTab === 'communities' ? ' active' : ''}`} onClick={() => setActiveTab('communities')}>
                <FaUsers className="sidebar-icon" /> <span>Communities</span>
              </button>
              <button
                className={`sidebar-tab${activeTab === 'messages' ? ' active' : ''}`}
                onClick={() => openMessages()}
              >
                <FaEnvelope className="sidebar-icon" /> <span>Messages</span>
              </button>
              <button className={`sidebar-tab${activeTab === 'create' ? ' active' : ''}`} onClick={() => setActiveTab('create')}>
                <FaPlus className="sidebar-icon" /> <span>Create</span>
              </button>
              <button className={`sidebar-tab${activeTab === 'profile' ? ' active' : ''}`} onClick={handleNavigateToMyProfile}>
                <FaUser className="sidebar-icon" /> <span>Profile</span>
              </button>
              <button className={`sidebar-tab${activeTab === 'settings' ? ' active' : ''}`} onClick={() => setActiveTab('settings')}>
                <FaCog className="sidebar-icon" /> <span>Settings</span>
              </button>
            </nav>
          </aside>
        )}
        <div className={`feed-col`}>
          {activeTab === 'home' && <Feed onNavigateToProfile={handleNavigateToProfile} />}
          {activeTab === 'profile' && !showSettings && (
            <ProfilePage
              userProfile={viewingUserProfile}
              onBackToHome={handleBackToHome}
              onNavigateToSettings={() => setShowSettings(true)}
              onStartChat={handleStartChatFromProfile}
              isMobile={isMobile}
            />
          )}
          {activeTab === 'profile' && showSettings && (
            <SettingsPage 
              onLogout={onLogout}
              onBackToProfile={() => setShowSettings(false)}
              isMobile={isMobile}
            />
          )}
          {activeTab === 'messages' && currentUser && (
            <MessagePanel
              currentUser={currentUser}
              initialParticipantId={pendingChatUserId}
              onConversationOpened={() => setPendingChatUserId(null)}
            />
          )}
          {activeTab === 'notifications' && <NotificationPage />}
          {activeTab === 'communities' && <CommonCommunity />}
          {activeTab === 'create' && <CreatePage />}
          {activeTab === 'search' && <SearchComponent />}
          {activeTab === 'settings' && !isMobile && <SettingsPage onLogout={onLogout} />}
          {/* Add more tab content here later */}
        </div>
      </div>
      {isMobile && <MobileFooter />}
    </div>
  );
}
