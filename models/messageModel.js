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
      trim: true,
      required: true,
    },
    // The family group this message belongs to.
    // We can define a family group by the ID of the user who initiated the family or a dedicated Family model.
    // For simplicity, let's assume a family group is identified by the 'addedBy' field of the initial member or a common ancestor.
    // Or, more robustly, we'll create a Chat model later that groups users.
    // For now, let's keep it simple and associate messages with a chat/group ID.
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat', // We will create this model next
      required: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isEdited: {
        type: Boolean,
        default: false,
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt for message time
  }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;