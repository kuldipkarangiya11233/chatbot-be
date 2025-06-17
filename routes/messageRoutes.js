const express = require('express');
const router = express.Router();
const {
  sendMessage,
  allMessages,
  editMessage,
  // deleteMessage, // If needed
} = require('../controllers/messageController'); // We will create this controller next
const { protect } = require('../middleware/authMiddleware');

// Send a new message to a chat
router.route('/').post(protect, sendMessage);

// Get all messages for a specific chat
router.route('/:chatId').get(protect, allMessages);

// Edit an existing message
router.route('/:messageId').put(protect, editMessage);

// Delete a message (optional)
// router.route('/:messageId').delete(protect, deleteMessage);

module.exports = router;