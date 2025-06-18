const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    isAI: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const chatSchema = mongoose.Schema(
  {
    // For family chat - patient ID
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.chatType === 'family';
      }
    },
    // For AI chat - can be patient or family member
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Chat type: 'family' or 'ai'
    chatType: {
      type: String,
      enum: ['family', 'ai'],
      required: true,
    },
    // For AI chats - title of the conversation
    title: {
      type: String,
      default: 'New Conversation',
    },
    messages: [messageSchema],
    // Store the last message timestamp for sorting
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // For AI chats - store the family context
    familyContext: {
      patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      familyMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
chatSchema.index({ patient: 1, lastMessageAt: -1 });
chatSchema.index({ createdBy: 1, chatType: 1, lastMessageAt: -1 });
chatSchema.index({ 'familyContext.patientId': 1, chatType: 1, lastMessageAt: -1 });

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;