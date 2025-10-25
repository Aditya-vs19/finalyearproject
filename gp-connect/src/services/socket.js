import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (!this.socket) {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return null;
      }

      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: {
          token: token
        }
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.isConnected = false;
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Community socket methods
  joinCommunity(communityId) {
    if (this.socket) {
      this.socket.emit('joinCommunity', { communityId });
    }
  }

  leaveCommunity(communityId) {
    if (this.socket) {
      this.socket.emit('leaveCommunity', { communityId });
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('community:message', callback);
    }
  }

  offNewMessage(callback) {
    if (this.socket) {
      this.socket.off('community:message', callback);
    }
  }

  onMemberUpdate(callback) {
    if (this.socket) {
      this.socket.on('community:memberUpdate', callback);
    }
  }

  offMemberUpdate(callback) {
    if (this.socket) {
      this.socket.off('community:memberUpdate', callback);
    }
  }

  onCommunityMetaUpdate(callback) {
    if (this.socket) {
      this.socket.on('community:metaUpdate', callback);
    }
  }

  offCommunityMetaUpdate(callback) {
    if (this.socket) {
      this.socket.off('community:metaUpdate', callback);
    }
  }

  // Post like functionality
  onPostLikeUpdate(callback) {
    if (this.socket) {
      this.socket.on('post:likeUpdate', callback);
    }
  }

  offPostLikeUpdate(callback) {
    if (this.socket) {
      this.socket.off('post:likeUpdate', callback);
    }
  }

  // Post comment functionality
  onPostCommentUpdate(callback) {
    if (this.socket) {
      this.socket.on('post:commentUpdate', callback);
    }
  }

  offPostCommentUpdate(callback) {
    if (this.socket) {
      this.socket.off('post:commentUpdate', callback);
    }
  }

  // Notification functionality
  onNewNotification(callback) {
    if (this.socket) {
      this.socket.on('notification:new', callback);
    }
  }

  offNewNotification(callback) {
    if (this.socket) {
      this.socket.off('notification:new', callback);
    }
  }

  onNotificationRead(callback) {
    if (this.socket) {
      this.socket.on('notification:read', callback);
    }
  }

  offNotificationRead(callback) {
    if (this.socket) {
      this.socket.off('notification:read', callback);
    }
  }

  onNotificationDeleted(callback) {
    if (this.socket) {
      this.socket.on('notification:deleted', callback);
    }
  }

  offNotificationDeleted(callback) {
    if (this.socket) {
      this.socket.off('notification:deleted', callback);
    }
  }
}

export default new SocketService();
