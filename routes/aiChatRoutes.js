const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAIChats,
  createAIChat,
  getAIChatMessages,
  sendAIMessage,
  deleteAIChat,
} = require('../controllers/aiChatController');

// All routes are protected and require authentication
router.use(protect);

// Get all AI chats for the user and their family
router.get('/', getAIChats);

// Create a new AI chat
router.post('/', createAIChat);

// Get messages for a specific AI chat
router.get('/:chatId/messages', getAIChatMessages);

// Send message to AI
router.post('/:chatId/message', sendAIMessage);

// Delete an AI chat
router.delete('/:chatId', deleteAIChat);

module.exports = router; 