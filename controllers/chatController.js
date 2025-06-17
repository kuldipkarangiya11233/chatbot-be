const asyncHandler = require('express-async-handler');
const Chat = require('../models/chatModel.js');
const User = require('../models/userModel.js');

// @desc    Fetch all chats for a user
// @route   GET /api/chat
// @access  Private
const fetchUserChats = asyncHandler(async (req, res) => {
  try {
    // Find chats where the logged-in user is a member
    // Populate user details (excluding password) and latest message details
    // Sort by updatedAt to get the most recently active chats first
    const chats = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate('users', '-password') // Populate users in the chat, exclude their passwords
      .populate('groupAdmin', '-password') // Populate admin details, exclude password
      .populate('latestMessage') // Populate the latest message
      .sort({ updatedAt: -1 }); // Sort by last updated

    // Further populate the sender details within latestMessage
    const results = await User.populate(chats, {
      path: 'latestMessage.sender',
      select: 'name email', // Select specific fields for the sender
    });

    res.status(200).send(results);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});


// @desc    Access a chat or create if not exists (primarily for 1-on-1, adapted for family context)
// @route   POST /api/chat/:userId (though for family, it's usually one group chat)
// @access  Private
// This function might be less relevant for the "single family group chat" model,
// but can be a foundation if multiple chat groups per user are ever needed.
// For the current scope, `fetchUserChats` is more direct for getting the family chat.
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.params; // The other user ID to chat with (or a target user for a group)

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  // Check if a chat with this user (or a group chat involving this user) already exists.
  // For a family chat, this logic would be different: you'd fetch the existing family chat.
  // The current model implies one main family chat, created at registration/member add.

  // This is more for a direct 1-on-1 chat creation logic:
  var isChat = await Chat.find({
    isGroupChat: false, // Assuming we might want 1-on-1 chats later
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } }, // Logged-in user
      { users: { $elemMatch: { $eq: userId } } },      // The other user
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]); // Send the existing 1-on-1 chat
  } else {
    // Create a new 1-on-1 chat
    var chatData = {
      chatName: "sender", // Default name for 1-on-1, can be improved
      isGroupChat: false,
      users: [req.user._id, userId], // Logged-in user and the other user
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});


// Note: createGroupChat, renameGroupChat, addToGroup, removeFromGroup
// are more explicitly handled by user registration, addFamilyMember, and future removeFamilyMember logic
// in userController.js for the specific "Family Chat" use case.
// If generic group chat management is needed later, those functions would be built out here.

module.exports = {
  fetchUserChats,
  accessChat,
  // createGroupChat, (Handled in userController for family chat)
  // renameGroupChat,
  // addToGroup, (Handled in userController for family chat)
  // removeFromGroup,
};