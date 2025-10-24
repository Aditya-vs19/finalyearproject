import mongoose from 'mongoose';

const postSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    caption: {
      type: String,
      required: true,
    },
    image: {
      type: String, // Storing the path to the image
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    likesCount: {
      type: Number,
      default: 0
    },
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      text: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    commentsCount: {
      type: Number,
      default: 0
    },
    isGlobalPost: {
      type: Boolean,
      default: false,
      index: true // Index for efficient querying
    },
    postType: {
      type: String,
      enum: ['regular', 'admin_announcement', 'global'],
      default: 'regular',
      index: true
    }
  },
  {
    timestamps: true,
  }
);

const Post = mongoose.model('Post', postSchema);

export default Post;
