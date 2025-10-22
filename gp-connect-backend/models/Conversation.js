import mongoose from 'mongoose';

const membersValidator = {
  validator(value) {
    return Array.isArray(value) && value.length === 2;
  },
  message: 'Conversation must include exactly two members',
};

const conversationSchema = new mongoose.Schema(
  {
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      ],
      validate: membersValidator,
    },
    lastMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

conversationSchema.pre('validate', function sortMembers() {
  if (Array.isArray(this.members)) {
    this.members = this.members
      .map((member) => member?.toString())
      .sort()
      .map((memberId) => new mongoose.Types.ObjectId(memberId));
    if (this.members.length === 2 && this.members[0].equals(this.members[1])) {
      this.invalidate('members', 'Conversation members must be unique');
    }
  }
});

conversationSchema.index({ members: 1 }, { unique: true });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
