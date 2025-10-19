import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
});

// Add auth token to requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Assuming 'token' is where JWT is stored
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      // Optionally redirect to login, but for now, we'll let the component handle it
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions - Updated for email verification flow
export const authAPI = {
  login: (credentials) => API.post('/auth/login', credentials),
  register: (userData) => API.post('/auth/register', userData),
  verifyOtp: (data) => API.post('/auth/verify', data),
};

export const profileAPI = {
  getCurrentUserProfile: () => API.get('/profile/me'),
  getUserProfile: (userId) => API.get(`/profile/${userId}`),
  updateProfile: (userId, data) => API.put(`/profile/${userId}`, data),
  uploadProfilePicture: (userId, formData) => API.post(`/profile/${userId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  changePassword: (userId, data) => API.put(`/profile/${userId}/password`, data),
  searchUsers: (query) => API.get(`/profile/search?query=${encodeURIComponent(query)}`),
  followUser: (userId) => API.post(`/profile/${userId}/follow`),
  unfollowUser: (userId) => API.post(`/profile/${userId}/unfollow`),
  testUsers: () => API.get('/profile/test-users'),
};

export const postsAPI = {
  getPosts: () => API.get('/posts'),
  createPost: (data) => API.post('/posts', data),
  getUserPosts: (userId) => API.get(`/posts/user/${userId}`),
  updatePost: (postId, data) => API.put(`/posts/${postId}`, data),
  deletePost: (postId) => API.delete(`/posts/${postId}`),
  toggleLike: (postId) => API.post(`/posts/${postId}/like`),
  getPostLikes: (postId) => API.get(`/posts/${postId}/likes`),
  addComment: (postId, text) => API.post(`/posts/${postId}/comments`, { text }),
  getPostComments: (postId) => API.get(`/posts/${postId}/comments`),
};

// Community API functions
export const communitiesAPI = {
  listCommunities: () => API.get('/community'),
  getCommunity: (communityId) => API.get(`/community/${communityId}`),
  joinCommunity: (communityId) => API.post(`/community/${communityId}/join`),
  leaveCommunity: (communityId) => API.post(`/community/${communityId}/leave`),
  getCommunityMessages: (communityId) => API.get(`/community/${communityId}/messages`),
  sendMessage: (communityId, content) => API.post(`/community/${communityId}/messages`, { content }),
};

export const messagesAPI = {
  getConversations: () => API.get('/messages/conversations/'),
};

export const notificationsAPI = {
  getNotifications: () => API.get('/notifications/'),
};

export default API; 