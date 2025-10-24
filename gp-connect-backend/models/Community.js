import mongoose from 'mongoose';

const communitySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '🌐',
    },
    isAnnouncement: {
      type: Boolean,
      default: false,
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    messages: [{
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      content: {
        type: String,
        required: function() {
          return !this.image;
        }
      },
      image: {
        type: String,
        required: false
      },
      messageType: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
  }
);

const Community = mongoose.model('Community', communitySchema);

export default Community;
