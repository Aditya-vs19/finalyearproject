import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';

dotenv.config();

const router = express.Router();

// Debug endpoint to check database state
router.get('/debug/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('fullName email following followers')
      .populate('following', 'fullName email')
      .populate('followers', 'fullName email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mutualFollowers = user.followers.filter(follower =>
      user.following.some(following => following._id.toString() === follower._id.toString())
    );

    res.json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      following: user.following.map(f => ({ _id: f._id, fullName: f.fullName })),
      followers: user.followers.map(f => ({ _id: f._id, fullName: f.fullName })),
      mutualFollowers: mutualFollowers.map(f => ({ _id: f._id, fullName: f.fullName })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Debug endpoint to check conversation
router.get('/debug/conversation/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    const sortPair = (a, b) => {
      const [first, second] = [a, b].map(id => id.toString()).sort();
      return [new mongoose.Types.ObjectId(first), new mongoose.Types.ObjectId(second)];
    };

    const members = sortPair(userId1, userId2);
    
    const conversation = await Conversation.findOne({ members })
      .populate('members', 'fullName email');

    res.json({
      found: !!conversation,
      conversation: conversation || null,
      searchedMembers: members.map(m => m.toString()),
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;
