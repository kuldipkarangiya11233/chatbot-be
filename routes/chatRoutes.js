const express = require('express');
const router = express.Router();
const {
  accessChat, // Or create if not exists for 1-on-1, but here it's family group
  fetchUserChats, // Get all family chats a user belongs to (usually one)
  // createGroupChat, // Already handled during registration/add member for family chat
  // renameGroupChat, // Potentially for future customization
  // addToGroup, // Already handled by addFamilyMember logic
  // removeFromGroup, // To be implemented (family member removal)
} = require('../controllers/chatController'); // We will create this controller next
const { protect } = require('../middleware/authMiddleware');

// Get all chats for the logged-in user
router.route('/').get(protect, fetchUserChats);

// Access or create a specific chat (more for 1-on-1, but can be adapted)
// For family chat, it's usually one main chat.
// This endpoint might be useful if a user could be part of multiple distinct family circles,
// but for now, we assume one primary family chat.
router.route('/:userId').post(protect, accessChat); // Example: access chat with a specific user (might not be primary use case here)


// Group chat functionalities (some are implicitly handled elsewhere)
// router.route('/group').post(protect, createGroupChat); // Family chat created on registration/add member
// router.route('/group/rename').put(protect, renameGroupChat);
// router.route('/group/add').put(protect, addToGroup); // Handled by addFamilyMember
// router.route('/group/remove').put(protect, removeFromGroup); // For removing a member from chat

module.exports = router;