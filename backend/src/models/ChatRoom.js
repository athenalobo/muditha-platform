const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['one_on_one', 'group', 'ai_chat', 'therapy_session', 'peer_support'],
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'therapist', 'admin'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  settings: {
    isPrivate: { type: Boolean, default: false },
    allowAnonymous: { type: Boolean, default: false },
    maxParticipants: { type: Number, default: 50 },
    aiModeration: { type: Boolean, default: true },
    crisisDetection: { type: Boolean, default: true }
  },
  aiAssistant: {
    isEnabled: { type: Boolean, default: false },
    personality: {
      type: String,
      enum: ['supportive', 'professional', 'friendly', 'clinical'],
      default: 'supportive'
    },
    specialization: [String] // e.g., ['anxiety', 'depression', 'grief']
  },
  lastActivity: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ type: 1, isActive: 1 });
chatRoomSchema.index({ createdBy: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);