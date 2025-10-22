import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Create a new notification
export const createNotification = async (recipientId, senderId, type, message, relatedPost = null, relatedComment = null) => {
  try {
    // Don't create notification if sender and recipient are the same
    if (recipientId.toString() === senderId.toString()) {
      return null;
    }

    // Check if a similar notification already exists (to avoid spam)
    const existingNotification = await Notification.findOne({
      recipient: recipientId,
      sender: senderId,
      type,
      relatedPost,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
    });

    if (existingNotification) {
      // Update the existing notification instead of creating a new one
      existingNotification.message = message;
      existingNotification.isRead = false;
      existingNotification.createdAt = new Date();
      await existingNotification.save();
      return existingNotification;
    }

    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      message,
      relatedPost,
      relatedComment,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get notifications for a user
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'fullName profilePic')
      .populate('relatedPost', 'caption image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    res.json({
      notifications,
      unreadCount,
      currentPage: page,
      totalPages: Math.ceil(await Notification.countDocuments({ recipient: userId }) / limit),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
};