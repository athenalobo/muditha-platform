const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  messageType: {
    type: String,
    enum: ['text', 'ai_response', 'system', 'image', 'file'],
    default: 'text'
  },
  metadata: {
    sentiment: String, // Will be populated by AI
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'crisis'],
      default: 'low'
    },
    aiAnalysis: {
      emotion: String,
      topics: [String],
      urgency: Number // 1-10 scale
    }
  },
  isEdited: { type: Boolean, default: false },
  editedAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);