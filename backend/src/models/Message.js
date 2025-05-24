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
    required: function() {
      // Only require sender if it's not an AI message
      return this.type !== 'ai_response';
    }
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'ai_response', 'system'],
    default: 'text'
  },
  // Make metadata flexible to store objects
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
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
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Index for efficient querying
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);