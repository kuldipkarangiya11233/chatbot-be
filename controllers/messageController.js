const asyncHandler = require('express-async-handler');
const Message = require('../models/messageModel.js');
const User = require('../models/userModel.js');
const Chat = require('../models/chatModel.js');

// @desc    Get all messages for a chat
// @route   GET /api/message/:chatId
// @access  Private
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name email') // Populate sender's name and email
      .populate('chat'); // Populate chat details (though often not needed if already in chat context)
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Send a new message
// @route   POST /api/message
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log('Invalid data passed into request: content or chatId missing');
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id, // Logged-in user is the sender
    content: content,
    chat: chatId,
  };

  try {
    var message = await Message.create(newMessage);

    // Populate sender and chat details for the created message
    message = await message.populate('sender', 'name'); // Populate sender's name
    message = await message.populate('chat');           // Populate chat details
    
    // Populate the users within the chat (to know who is in the chat)
    message = await User.populate(message, {
      path: 'chat.users',
      select: 'name email', // Select specific fields for users in the chat
    });

    // Update the latestMessage field in the Chat model
    await Chat.findByIdAndUpdate(req.body.chatId, {
      latestMessage: message,
    });

    res.json(message); // Send the fully populated message back
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Edit an existing message
// @route   PUT /api/message/:messageId
// @access  Private
const editMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content) {
        res.status(400);
        throw new Error('Content cannot be empty for editing.');
    }

    const message = await Message.findById(messageId);

    if (!message) {
        res.status(404);
        throw new Error('Message not found.');
    }

    // Check if the logged-in user is the sender of the message
    if (message.sender.toString() !== userId.toString()) {
        res.status(403); // Forbidden
        throw new Error('User not authorized to edit this message.');
    }

    message.content = content;
    message.isEdited = true; // Mark the message as edited
    // The updatedAt timestamp will be automatically updated by Mongoose

    const updatedMessage = await message.save();

    // Populate details for the response
    const populatedMessage = await Message.findById(updatedMessage._id)
        .populate('sender', 'name email')
        .populate('chat');

    res.json(populatedMessage);
});


module.exports = { allMessages, sendMessage, editMessage };