import React, { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import socketService from '../services/socket.js';
import './NotificationPage.css';

const NotificationPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Real-time notifications using socket.io
  useEffect(() => {
    const handleNewNotification = (notification) => {
      console.log('📢 New notification received:', notification);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    const handleNotificationRead = (data) => {
      const { notificationId } = data;
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleNotificationDeleted = (data) => {
      const { notificationId } = data;
      setNotifications(prev => 
        prev.filter(notif => notif._id !== notificationId)
      );
    };

    // Connect to socket and listen for notification updates
    socketService.connect();
    socketService.onNewNotification(handleNewNotification);
    socketService.onNotificationRead(handleNotificationRead);
    socketService.onNotificationDeleted(handleNotificationDeleted);

    return () => {
      socketService.offNewNotification(handleNewNotification);
      socketService.offNotificationRead(handleNotificationRead);
      socketService.offNotificationDeleted(handleNotificationDeleted);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      console.log('Fetching notifications...');
      const response = await notificationsAPI.getNotifications();
      console.log('Notifications response:', response.data);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      console.error('Error details:', error.response?.data || error.message);
      setError('Failed to load notifications. Please restart the backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await notificationsAPI.deleteNotification(notificationId);
      setNotifications(prev => 
        prev.filter(notif => notif._id !== notificationId)
      );
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n._id === notificationId);
      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - notificationDate) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'follow': return '👤';
      case 'mention': return '@';
      default: return '🔔';
    }
  };

  if (loading) {
    return (
      <div className="notification-page">
        <div className="notification-content">
          <h2 className="notification-title">Notifications</h2>
          <div className="loading-spinner">Loading notifications...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notification-page">
        <div className="notification-content">
          <h2 className="notification-title">Notifications</h2>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-page">
      <div className="notification-content">
        <div className="notification-header">
          <h2 className="notification-title">
            Notifications
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </h2>
          {unreadCount > 0 && (
            <button 
              className="mark-all-read-btn"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </button>
          )}
        </div>
        
        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="no-notifications">
              <div className="no-notifications-icon">🔔</div>
              <p>No notifications yet</p>
              <span>When someone likes, comments, or follows you, you'll see it here</span>
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                key={notification._id}
                onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
              >
                <div className="notification-avatar-container">
                  <img 
                    className="notification-avatar" 
                    src={notification.sender.profilePic || '/default-avatar.png'} 
                    alt={notification.sender.fullName}
                    onError={(e) => {
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <span className="notification-type-icon">
                    {getNotificationIcon(notification.type)}
                  </span>
                </div>
                
                <div className="notification-text">
                  <span className="notification-user">
                    {notification.sender.fullName}
                  </span>
                  {' '}
                  <span className="notification-action">
                    {notification.message}
                  </span>
                  <div className="notification-time">
                    {formatTimeAgo(notification.createdAt)}
                  </div>
                </div>

                <div className="notification-actions">
                  {!notification.isRead && (
                    <button 
                      className="mark-read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification._id);
                      }}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notification._id);
                    }}
                    title="Delete notification"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationPage; 