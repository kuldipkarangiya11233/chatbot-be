const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  addFamilyMember,
  // removeFamilyMember, // We'll add this later
  // getAllUsers, // For admin or specific purposes, if needed
} = require('../controllers/userController'); // We will create this controller next
const { protect } = require('../middleware/authMiddleware'); // We will create this middleware next

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.post('/profile/addmember', protect, addFamilyMember);
// router.delete('/profile/removemember/:memberId', protect, removeFamilyMember); // Placeholder for now
// router.get('/', protect, getAllUsers); // Placeholder for now

module.exports = router;