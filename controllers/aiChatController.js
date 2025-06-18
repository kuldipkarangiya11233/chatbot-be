const asyncHandler = require('express-async-handler');
const Chat = require('../models/chatModel');
const User = require('../models/userModel');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// @desc    Get all AI chats for a user and their family
// @route   GET /api/ai-chat
// @access  Private
const getAIChats = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine the patient ID for family context
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    
    // Get AI chats created by the user or shared within their family
    const chats = await Chat.find({
      $or: [
        { createdBy: user._id, chatType: 'ai' },
        { 'familyContext.patientId': patientId, chatType: 'ai' }
      ]
    })
    .populate('createdBy', 'fullName email')
    .populate('messages.sender', 'fullName email')
    .populate('familyContext.patientId', 'fullName email')
    .populate('familyContext.familyMembers', 'fullName email')
    .sort({ lastMessageAt: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error in getAIChats:', error);
    res.status(500).json({ message: 'Error fetching AI chats', error: error.message });
  }
});

// @desc    Create a new AI chat
// @route   POST /api/ai-chat
// @access  Private
const createAIChat = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine the patient ID for family context
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    
    // Get family members for context
    const patient = await User.findById(patientId).populate('familyMembers');
    const familyMembers = patient ? patient.familyMembers : [];

    const newChat = new Chat({
      createdBy: user._id,
      chatType: 'ai',
      title: 'New Conversation',
      familyContext: {
        patientId: patientId,
        familyMembers: familyMembers.map(member => member._id),
      },
    });

    const savedChat = await newChat.save();
    
    // Populate the saved chat
    const populatedChat = await Chat.findById(savedChat._id)
      .populate('createdBy', 'fullName email')
      .populate('familyContext.patientId', 'fullName email')
      .populate('familyContext.familyMembers', 'fullName email');

    res.status(201).json(populatedChat);
  } catch (error) {
    console.error('Error in createAIChat:', error);
    res.status(500).json({ message: 'Error creating AI chat', error: error.message });
  }
});

// @desc    Get messages for a specific AI chat
// @route   GET /api/ai-chat/:chatId/messages
// @access  Private
const getAIChatMessages = asyncHandler(async (req, res) => {
  try {
    const { chatId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const chat = await Chat.findById(chatId)
      .populate('createdBy', 'fullName email')
      .populate('messages.sender', 'fullName email')
      .populate('familyContext.patientId', 'fullName email')
      .populate('familyContext.familyMembers', 'fullName email');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user has access to this chat
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    
    // More flexible access control - allow access if:
    // 1. User created the chat
    // 2. User is the patient in the family context
    // 3. User is a family member and the chat belongs to their family
    // const hasAccess = 
    //   chat.createdBy.toString() === user._id.toString() || 
    //   (patientId && chat.familyContext.patientId && 
    //    chat.familyContext.patientId.toString() === patientId.toString()) ||
    //   (chat.familyContext.familyMembers && 
    //    chat.familyContext.familyMembers.some(member => 
    //      member._id && member._id.toString() === user._id.toString()
    //    ));

    // if (!hasAccess) {
    //   console.log('Access denied for user:', user._id, 'chat:', chatId);
    //   console.log('User role:', user.role, 'Patient ID:', patientId);
    //   console.log('Chat created by:', chat.createdBy._id);
    //   console.log('Family context patient:', chat.familyContext.patientId);
    //   return res.status(403).json({ message: 'Access denied to this chat' });
    // }

    res.json(chat.messages);
  } catch (error) {
    console.error('Error in getAIChatMessages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
});

// @desc    Send message to AI and get response
// @route   POST /api/ai-chat/:chatId/message
// @access  Private
const sendAIMessage = asyncHandler(async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, senderName } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const chat = await Chat.findById(chatId)
      .populate('createdBy', 'fullName email')
      .populate('messages.sender', 'fullName email')
      .populate('familyContext.patientId', 'fullName email')
      .populate('familyContext.familyMembers', 'fullName email');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user has access to this chat - same logic as getAIChatMessages
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    
    // const hasAccess = 
    //   chat.createdBy.toString() === user._id.toString() || 
    //   (patientId && chat.familyContext.patientId && 
    //    chat.familyContext.patientId.toString() === patientId.toString()) ||
    //   (chat.familyContext.familyMembers && 
    //    chat.familyContext.familyMembers.some(member => 
    //      member._id && member._id.toString() === user._id.toString()
    //    ));

    // if (!hasAccess) {
    //   console.log('Access denied for user:', user._id, 'chat:', chatId);
    //   console.log('User role:', user.role, 'Patient ID:', patientId);
    //   console.log('Chat created by:', chat.createdBy._id);
    //   console.log('Family context patient:', chat.familyContext.patientId);
    //   return res.status(403).json({ message: 'Access denied to this chat' });
    // }

    // Add user message with sender name
    const userMessage = {
      sender: user._id,
      content: content.trim(),
      isAI: false,
      senderName: senderName || user.fullName,
    };

    chat.messages.push(userMessage);

    // Generate AI response
    try {
      // Create system prompt with family context
      const familyContext = chat.familyContext;
      const patientName = familyContext.patientId?.fullName || 'the patient';
      const familyMembers = familyContext.familyMembers || [];
      const familyNames = familyMembers.map(member => member.fullName).join(', ');
      
      const systemPrompt = `You are a helpful healthcare assistant for a family. 
      
Family Context:
- Patient: ${patientName}
- Family Members: ${familyNames || 'None'}
- Current User: ${senderName || user.fullName} (${user.role})

Provide clear, accurate, and empathetic responses to health-related questions. Consider the family context when giving advice. Be supportive and informative while maintaining medical accuracy.`;

      // Prepare conversation history for OpenAI
      const conversationHistory = chat.messages.map(msg => ({
        role: msg.isAI ? 'assistant' : 'user',
        content: msg.content
      }));

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0].message.content;

      // Add AI response
      const aiMessage = {
        sender: user._id, // Use user ID as sender for AI messages
        content: aiResponse,
        isAI: true,
      };

      chat.messages.push(aiMessage);
      chat.lastMessageAt = new Date();

      // Update chat title if it's still default
      if (chat.title === 'New Conversation' && chat.messages.length === 2) {
        // Generate a title based on the first user message
        const titleCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { 
              role: "system", 
              content: "Generate a short, descriptive title (max 50 characters) for this healthcare conversation. Return only the title, nothing else." 
            },
            { role: "user", content: content }
          ],
          max_tokens: 20,
          temperature: 0.3,
        });
        
        chat.title = titleCompletion.choices[0].message.content.trim();
      }

      await chat.save();

      // Populate the latest messages for response
      const populatedChat = await Chat.findById(chatId)
        .populate('messages.sender', 'fullName email')
        .populate('createdBy', 'fullName email');

      const latestMessages = populatedChat.messages.slice(-2); // Get the last 2 messages (user + AI)

      res.json({
        chat: populatedChat,
        newMessages: latestMessages,
      });

    } catch (openaiError) {
      console.error('OpenAI API Error:', openaiError);
      // Remove the user's message since AI response failed
      chat.messages.pop();
      await chat.save();
      res.status(500).json({ 
        message: 'Error getting AI response', 
        error: openaiError.message 
      });
    }

  } catch (error) {
    console.error('Error in sendAIMessage:', error);
    res.status(500).json({ message: 'Error processing message', error: error.message });
  }
});

// @desc    Delete an AI chat
// @route   DELETE /api/ai-chat/:chatId
// @access  Private
const deleteAIChat = asyncHandler(async (req, res) => {
  try {
    const { chatId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user can delete this chat (only creator or patient can delete)
    const patientId = user.role === 'patient' ? user._id : user.associatedPatient;
    const canDelete = chat.createdBy.toString() === user._id.toString() || 
                     chat.familyContext.patientId.toString() === patientId.toString();

    if (!canDelete) {
      return res.status(403).json({ message: 'You can only delete your own chats or family chats' });
    }

    await Chat.findByIdAndDelete(chatId);

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error in deleteAIChat:', error);
    res.status(500).json({ message: 'Error deleting chat', error: error.message });
  }
});

// @desc    Update AI chat title
// @route   PUT /api/ai-chat/:chatId/title
// @access  Private
const updateChatTitle = asyncHandler(async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Chat title is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const chat = await Chat.findById(chatId)
      .populate('createdBy', 'fullName email')
      .populate('messages.sender', 'fullName email')
      .populate('familyContext.patientId', 'fullName email')
      .populate('familyContext.familyMembers', 'fullName email');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    chat.title = title.trim();
    await chat.save();

    res.json(chat);
  } catch (error) {
    console.error('Error in updateChatTitle:', error);
    res.status(500).json({ message: 'Error updating chat title', error: error.message });
  }
});

module.exports = {
  getAIChats,
  createAIChat,
  getAIChatMessages,
  sendAIMessage,
  deleteAIChat,
  updateChatTitle,
}; 