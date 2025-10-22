import mongoose from 'mongoose';

const prekeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    prekeyPublic: {
      type: String,
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },
    reservedAt: {
      type: Date,
    },
    usedAt: {
      type: Date,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

prekeySchema.index({ userId: 1, isUsed: 1, reservedAt: 1 });

const Prekey = mongoose.model('Prekey', prekeySchema);

export default Prekey;
