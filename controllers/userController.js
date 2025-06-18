const asyncHandler = require('express-async-handler');
const User = require('../models/userModel.js');
const Chat = require('../models/chatModel.js');
const generateToken = require('../utils/generateToken.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc    Register a new user (patient)
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      role: 'patient', // Default role is patient
      isProfileComplete: false,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        email: user.email,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isProfileComplete: user.isProfileComplete,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Complete user profile
// @route   PUT /api/users/profile
// @access  Private
const completeProfile = async (req, res) => {
  try {
    const { fullName, mobileNumber, healthStage } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate required fields
    if (!fullName) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    if (user.role === 'family_member' && !user.associatedPatient) {
      return res.status(400).json({ message: 'Family member must have an associated patient before completing profile' });
    }

    // Update user profile
    user.fullName = fullName;
    user.mobileNumber = mobileNumber;
    user.healthStage = healthStage;
    user.isProfileComplete = true;

    // Password change logic
    if (req.body.password) {
      // Only allow password change if currentPassword is correct
      if (!req.body.currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password.' });
      }
      const isMatch = await user.matchPassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect.' });
      }
      user.password = req.body.password;
    }

    // Create a default family chat if none exists
    if (!user.familyChatId) {
      // Determine the patient ID based on user role
      const patientId = user.role === 'patient' ? user._id : user.associatedPatient;

      // Debug log to verify patientId
      console.log('Creating chat with patientId:', patientId, 'for user:', user._id, 'role:', user.role);

      const chat = await Chat.create({
        chatType: 'family',
        createdBy: user._id,
        patient: patientId, // Set patient based on role
        title: `${fullName}'s Family Chat`,
        messages: [],
        familyContext: {
          patientId: patientId,
          familyMembers: user.role === 'patient' ? user.familyMembers : [],
        },
      });

      // Update user with the new chat ID
      user.familyChatId = chat._id;
    }

    // Save the updated user
    const updatedUser = await user.save();

    // Debug log to verify updated user
    console.log('Updated user:', {
      _id: updatedUser._id,
      familyChatId: updatedUser.familyChatId,
      role: updatedUser.role,
      associatedPatient: updatedUser.associatedPatient,
    });

    res.json({
      _id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      mobileNumber: updatedUser.mobileNumber,
      healthStage: updatedUser.healthStage,
      role: updatedUser.role,
      isProfileComplete: updatedUser.isProfileComplete,
      familyChatId: updatedUser.familyChatId,
      associatedPatient: updatedUser.associatedPatient,
      familyMembers: updatedUser.familyMembers,
    });
  } catch (error) {
    console.error('Error in completeProfile:', {
      message: error.message,
      stack: error.stack,
      userId: req.user._id,
    });
    res.status(500).json({ message: error.message });
  }
};
// @desc    Add family member
// @route   POST /api/users/family-member
// @access  Private
const addFamilyMember = async (req, res) => {
  try {
    const { fullName, email, mobileNumber, password, relation, assignedTask } = req.body;
    
    // Get the current user (could be patient or family member)
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine the patient ID - if current user is patient, use their ID, otherwise use their associated patient
    const patientId = currentUser.role === 'patient' ? currentUser._id : currentUser.associatedPatient;
    if (!patientId) {
      return res.status(400).json({ message: 'Invalid user role or missing patient association' });
    }

    // Get the patient to add the family member to
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if email already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create family member
    const familyMember = await User.create({
      fullName,
      email,
      mobileNumber,
      password,
      role: 'family_member',
      relation,
      associatedPatient: patientId,
      isProfileComplete: true, // Family members don't need profile completion
    });

    // Add family member to patient's list
    patient.familyMembers.push(familyMember._id);
    
    // Add assigned task if provided
    if (assignedTask) {
      patient.assignedTasks.push({
        assignedTo: familyMember._id,
        task: assignedTask,
      });
    }

    await patient.save();

    // Get updated family data for socket emission
    const updatedFamilyMembers = await User.find({ _id: { $in: patient.familyMembers } })
      .select('-password');

    const response = {
      _id: familyMember._id,
      fullName: familyMember.fullName,
      email: familyMember.email,
      relation: familyMember.relation,
      assignedTask,
      addedBy: {
        _id: currentUser._id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
      patient: {
        _id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
      },
      familyMembers: updatedFamilyMembers,
    };

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit to the patient's room
      io.to(patient._id.toString()).emit('family member added', response);
      // Also emit to the new family member's room if they're connected
      io.to(familyMember._id.toString()).emit('family member added', response);
      // Emit to all existing family members
      patient.familyMembers.forEach(memberId => {
        if (memberId.toString() !== familyMember._id.toString()) {
          io.to(memberId.toString()).emit('family member added', response);
        }
      });
    }

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete family member
// @route   DELETE /api/users/family-member/:memberId
// @access  Private
const deleteFamilyMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const patient = await User.findById(req.user._id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if the member exists and is actually a family member of this patient
    const familyMember = await User.findById(memberId);
    if (!familyMember) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    if (familyMember.associatedPatient?.toString() !== patient._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own family members' });
    }

    // Remove family member from patient's familyMembers array
    patient.familyMembers = patient.familyMembers.filter(
      member => member.toString() !== memberId
    );

    // Remove assigned tasks for this family member
    patient.assignedTasks = patient.assignedTasks.filter(
      task => task.assignedTo.toString() !== memberId
    );

    await patient.save();

    // Delete the family member user account
    await User.findByIdAndDelete(memberId);

    // Get updated family data for socket emission
    const updatedFamilyMembers = await User.find({ _id: { $in: patient.familyMembers } })
      .select('-password');

    const response = {
      deletedMemberId: memberId,
      patient: {
        _id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
      },
      familyMembers: updatedFamilyMembers,
    };

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit to the patient's room
      io.to(patient._id.toString()).emit('family member deleted', response);
    }

    res.json(response);
  } catch (error) {
    console.error('Error deleting family member:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('familyMembers', 'fullName email relation')
      .populate('assignedTasks.assignedTo', 'fullName email relation');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get family members
// @route   GET /api/users/family-members
// @access  Private
const getFamilyMembers = async (req, res) => {
  try {
    // 1. Find the authenticated user
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let response = { patient: null, familyMembers: [] };

    if (user.role === 'patient') {
      // 2. For patients: Get their family members
      response.patient = user;
      response.familyMembers = await User.find({ _id: { $in: user.familyMembers } })
        .select('-password')
        .populate('assignedTasks');
    } else {
      // 3. For family members: Get the patient and their family members
      const patient = await User.findById(user.associatedPatient)
        .select('-password')
        .populate({
          path: 'familyMembers',
          select: '-password',
          populate: { path: 'assignedTasks' },
        });
      if (!patient) {
        return res.status(404).json({ message: 'Associated patient not found' });
      }
      response.patient = patient;
      response.familyMembers = patient.familyMembers;
    }

    // 4. Send response
    res.json(response);
  } catch (error) {
    // 5. Handle errors
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  completeProfile,
  addFamilyMember,
  deleteFamilyMember,
  getUserProfile,
  getFamilyMembers,
};