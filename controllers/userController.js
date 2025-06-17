const asyncHandler = require('express-async-handler');
const User = require('../models/userModel.js');
const Chat = require('../models/chatModel.js');
const generateToken = require('../utils/generateToken.js');

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    res.status(400);
    throw new Error('Please add all fields');
  }

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    email,
    password,
  });

  if (user) {
    // Automatically create a family chat for the new user
    const familyChat = await Chat.create({
        chatName: `${user.email}'s Family Chat`, // Or a more generic name
        users: [user._id],
        groupAdmin: user._id,
        isGroupChat: true,
    });

    // Add this chat to the user's profile (though not strictly necessary with this model)
    // user.chats.push(familyChat._id); // If we had a 'chats' array in userModel
    // await user.save();


    res.status(201).json({
      _id: user._id,
      email: user.email,
      isProfileComplete: user.isProfileComplete,
      token: generateToken(user._id),
      message: 'User registered successfully. Please complete your profile.',
      familyChatId: familyChat._id // Send chat ID to client
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Authenticate user & get token (Login)
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // Find the family chat this user belongs to
    // This logic might need refinement based on how family chats are structured.
    // Assuming a user is part of one primary family chat they created or were added to.
    const familyChat = await Chat.findOne({ users: user._id, groupAdmin: user._id }) // If they are admin
                      || await Chat.findOne({ users: user._id }); // Or just a member

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      stage: user.stage,
      isProfileComplete: user.isProfileComplete,
      familyMembers: user.familyMembers, // Send current family members
      token: generateToken(user._id),
      familyChatId: familyChat ? familyChat._id : null, // Send chat ID
      message: user.isProfileComplete ? 'Login successful' : 'Login successful. Please complete your profile.',
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('familyMembers', 'name email stage'); // Populate family member details

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      stage: user.stage,
      isProfileComplete: user.isProfileComplete,
      familyMembers: user.familyMembers,
      createdAt: user.createdAt,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.mobileNumber = req.body.mobileNumber || user.mobileNumber;
    user.stage = req.body.stage || user.stage;

    // Check if essential profile details are now filled
    if (user.name && user.mobileNumber && user.stage) {
      user.isProfileComplete = true;
    } else {
      // If any of the required fields for profile completion are missing, mark as incomplete.
      // This ensures the popup appears if they later remove a required field.
      user.isProfileComplete = false;
    }
    
    // Password update logic
    if (req.body.password) { // This is the newPassword from frontend
        if (!req.body.currentPassword) {
            res.status(400);
            throw new Error('Please provide your current password to change it.');
        }

        const isMatch = await user.matchPassword(req.body.currentPassword);
        if (!isMatch) {
            res.status(401); // Unauthorized
            throw new Error('Incorrect current password.');
        }

        if (req.body.password !== req.body.confirmPassword) { // confirmPassword is confirmNewPassword from frontend
            res.status(400);
            throw new Error('New passwords do not match.');
        }
        if (req.body.password.length < 6) { // Validate new password length
            res.status(400);
            throw new Error('New password must be at least 6 characters long.');
        }
        user.password = req.body.password; // Hashing is handled by pre-save middleware
    } else if (req.body.currentPassword && !req.body.password) {
        // User provided current password but no new password
        res.status(400);
        throw new Error('Please provide a new password if you intend to change it.');
    }


    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      mobileNumber: updatedUser.mobileNumber,
      stage: updatedUser.stage,
      isProfileComplete: updatedUser.isProfileComplete,
      familyMembers: updatedUser.familyMembers,
      token: generateToken(updatedUser._id), // Re-issue token if sensitive info changed or for consistency
      message: 'Profile updated successfully.'
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});


// @desc    Add a family member
// @route   POST /api/users/profile/addmember
// @access  Private
const addFamilyMember = asyncHandler(async (req, res) => {
    const { name, relationship, email, password, confirmPassword } = req.body; // Relationship is for context, not stored directly in User model yet
    const adderUserId = req.user._id; // The user who is adding the new member

    if (!name || !email || !password || !confirmPassword) {
        res.status(400);
        throw new Error('Please provide name, email, password, and confirm password for the family member.');
    }

    if (password !== confirmPassword) {
        res.status(400);
        throw new Error('Passwords for the family member do not match.');
    }

    const memberExists = await User.findOne({ email });
    if (memberExists) {
        res.status(400);
        throw new Error('A user with this email already exists.');
    }

    // Create the new family member
    const newMember = await User.create({
        name, // Name is provided at creation by the adder
        email,
        password,
        isProfileComplete: false, // New member needs to complete their own mobile & stage
        addedBy: adderUserId, // Link to the user who added them
    });

    if (!newMember) {
        res.status(500);
        throw new Error('Could not create family member.');
    }

    // Add the new member to the adder's familyMembers list
    const adderUser = await User.findById(adderUserId);
    if (!adderUser) {
        // This should not happen if 'protect' middleware is working
        await User.findByIdAndDelete(newMember._id); // Rollback: delete the created member
        res.status(404);
        throw new Error('Adding user not found.');
    }
    adderUser.familyMembers.push(newMember._id);
    await adderUser.save();
    
    // Also add the adder to the new member's family list (reciprocal relationship)
    newMember.familyMembers.push(adderUserId);
    await newMember.save();


    // Add the new member to the existing family chat(s) of the adder.
    // Find all chats the adder is a part of.
    // For simplicity, we assume one primary family chat.
    // A more complex system might involve selecting which chat to add to.
    const familyChat = await Chat.findOne({ users: adderUserId });

    if (familyChat) {
        if (!familyChat.users.includes(newMember._id)) {
            familyChat.users.push(newMember._id);
            await familyChat.save();
        }
    } else {
        // This case should ideally not happen if a chat is created upon registration.
        // If it does, it implies an issue or a user without a chat.
        // We could create a new chat here, or log an error.
        // For now, let's assume the adder always has a chat.
        console.warn(`User ${adderUserId} tried to add a member but has no associated family chat.`);
        // Optionally, create a new chat for the adder and the new member:
        // const newFamilyChat = await Chat.create({
        //     chatName: `${adderUser.email}'s Family Chat`,
        //     users: [adderUserId, newMember._id],
        //     groupAdmin: adderUserId,
        //     isGroupChat: true,
        // });
        // console.log(`Created new chat ${newFamilyChat._id} for ${adderUser.email} and ${newMember.email}`);
    }


    res.status(201).json({
        _id: newMember._id,
        name: newMember.name,
        email: newMember.email,
        message: `Family member ${name} added successfully. They can now log in and complete their profile.`,
    });
});


module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  addFamilyMember,
};