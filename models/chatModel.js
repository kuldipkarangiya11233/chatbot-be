const mongoose = require('mongoose');

const chatSchema = mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
      default: "Family Chat" // Default name, can be customized if needed
    },
    isGroupChat: { // To distinguish between 1-on-1 and group chats if ever needed, though here it's always group
      type: Boolean,
      default: true,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    // The 'admin' of the chat, typically the user who initiated the family or a designated primary user.
    // This could be useful for certain administrative actions in the future.
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;