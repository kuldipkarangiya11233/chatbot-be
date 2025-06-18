const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getChats,
  createChat,
  sendFamilyMessage,
  getChatMessages,
  editFamilyMessage,
  deleteChat,
} = require('../controllers/chatController');

// All routes are protected and require authentication
router.use(protect);

// Get all chats for the user (patient or family member)
router.get('/', getChats);

// Create a new chat
router.post('/', createChat);

// Get messages for a specific chat
router.get('/:chatId/messages', getChatMessages);

// Send message to family chat
router.post('/message', sendFamilyMessage);

// Edit a message in family chat
router.put('/:chatId/messages/:messageId', editFamilyMessage);

// Delete a chat
router.delete('/:chatId', deleteChat);

module.exports = router;