const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  completeProfile,
  addFamilyMember,
  deleteFamilyMember,
  getUserProfile,
  getFamilyMembers,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/', registerUser);
router.post('/login', loginUser);

// Protected routes
router.use(protect);
router.get('/profile', getUserProfile);
router.put('/profile', completeProfile);
router.post('/family-member', addFamilyMember);
router.delete('/family-member/:memberId', deleteFamilyMember);
router.get('/family-members', getFamilyMembers);

module.exports = router;