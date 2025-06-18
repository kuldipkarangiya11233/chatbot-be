const asyncHandler = require('express-async-handler');
const Chat = require('../models/chatModel');
const User = require('../models/userModel');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// Get all chats for a patient and their family members
const getChats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let query = {};
    if (user.role === 'patient') {
      query.patient = user._id;
    } else if (user.role === 'family_member') {
      query.patient = user.associatedPatient;
    }

    const chat = await Chat.findOne(query)
      .sort({ lastMessageAt: -1 })
      .populate('patient', 'fullName email')
      .populate('messages.sender', 'fullName email');

    if (!chat) {
      return res.status(404).json({ message: 'Family chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error in getChats:', error);
    res.status(500).json({ message: 'Error fetching chat', error: error.message });
  }
};

// Create a new chat
const createChat = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    if (!patientId) {
      return res.status(400).json({ message: 'Invalid user role or missing patient association' });
    }

    const newChat = new Chat({
      patient: patientId,
      title: 'New Conversation',
    });

    const savedChat = await newChat.save();
    res.status(201).json(savedChat);
  } catch (error) {
    console.error('Error in createChat:', error);
    res.status(500).json({ message: 'Error creating chat', error: error.message });
  }
};

// Send message to family chat
const sendFamilyMessage = async (req, res) => {
  try {
    const { content, chatId } = req.body;
    
    if (!content || !chatId) {
      return res.status(400).json({ message: 'Content and chatId are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify chat belongs to patient or their family member
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user has access to this chat
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    if (chat.patient.toString() !== patientId.toString()) {
      return res.status(403).json({ message: 'Access denied to this chat' });
    }

    // Add message to chat
    const newMessage = {
      sender: user._id,
      content: content,
      isAI: false,
    };

    chat.messages.push(newMessage);
    chat.lastMessageAt = new Date();
    
    await chat.save();

    // Populate the sender information for the response
    const populatedChat = await Chat.findById(chatId)
      .populate('messages.sender', 'fullName email')
      .populate('patient', 'fullName email');

    // Get the last message (the one we just added)
    const lastMessage = populatedChat.messages[populatedChat.messages.length - 1];

    res.json(lastMessage);
  } catch (error) {
    console.error('Error in sendFamilyMessage:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

// Get messages for a specific chat
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const chat = await Chat.findById(chatId)
      .populate('messages.sender', 'fullName email')
      .populate('patient', 'fullName email');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user has access to this chat
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    if (chat.patient._id.toString() !== patientId.toString()) {
      return res.status(403).json({ message: 'Access denied to this chat' });
    }

    res.json(chat.messages);
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};

// Edit a message in family chat
const editFamilyMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content cannot be empty' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user has access to this chat
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    if (chat.patient.toString() !== patientId.toString()) {
      return res.status(403).json({ message: 'Access denied to this chat' });
    }

    // Find the message to edit
    const messageIndex = chat.messages.findIndex(msg => msg._id.toString() === messageId);
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const message = chat.messages[messageIndex];
    
    // Check if the user is the sender of the message
    if (message.sender.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    // Update the message
    chat.messages[messageIndex].content = content.trim();
    chat.messages[messageIndex].isEdited = true;
    chat.messages[messageIndex].updatedAt = new Date();
    
    await chat.save();

    // Populate the sender information for the response
    const populatedChat = await Chat.findById(chatId)
      .populate('messages.sender', 'fullName email')
      .populate('patient', 'fullName email');

    const editedMessage = populatedChat.messages[messageIndex];

    res.json(editedMessage);
  } catch (error) {
    console.error('Error in editFamilyMessage:', error);
    res.status(500).json({ message: 'Error editing message', error: error.message });
  }
};

// Delete a chat
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    if (!patientId) {
      return res.status(400).json({ message: 'Invalid user role or missing patient association' });
    }

    const chat = await Chat.findOneAndDelete({
      _id: chatId,
      patient: patientId,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error in deleteChat:', error);
    res.status(500).json({ message: 'Error deleting chat', error: error.message });
  }
};

// Note: createGroupChat, renameGroupChat, addToGroup, removeFromGroup
// are more explicitly handled by user registration, addFamilyMember, and future removeFamilyMember logic
// in userController.js for the specific "Family Chat" use case.
// If generic group chat management is needed later, those functions would be built out here.

module.exports = {
  fetchUserChats,
  accessChat,
  getChats,
  createChat,
  sendFamilyMessage,
  getChatMessages,
  deleteChat,
  editFamilyMessage,
  // createGroupChat, (Handled in userController for family chat)
  // renameGroupChat,
  // addToGroup, (Handled in userController for family chat)
  // removeFromGroup,
};