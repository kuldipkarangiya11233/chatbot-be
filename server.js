// Main backend server file
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // To parse JSON bodies

// Import Routes
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const aiChatRoutes = require('./routes/aiChatRoutes');

// Mount Routes
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/ai-chat', aiChatRoutes);


// Basic route
app.get('/', (req, res) => {
  res.send('ChatWithFamily API is running...');
});

// Error Handling Middlewares
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize Socket.IO
const io = require('socket.io')(server, {
  pingTimeout: 60000, // Close connection if no ping received for 60s
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Allow frontend origin
    // methods: ["GET", "POST"] // Allowed methods, if needed
  }
});

// Make io available to controllers
app.set('io', io);

io.on("connection", (socket) => {
  console.log("A user connected to Socket.IO:", socket.id);

  // Setup user specific room
  socket.on('setup', (userData) => {
    socket.join(userData._id); // User joins a room with their own ID
    console.log(`${userData.email || socket.id} connected and joined room: ${userData._id}`);
    socket.emit('connected'); // Emit back to client that connection is established
  });

  // Join a chat room
  socket.on('join chat', (room) => {
    socket.join(room);
    console.log("User " + socket.id + " joined chat room: " + room);
  });

  // Typing indicators
  socket.on('typing', (room) => socket.in(room).emit('typing', room)); // Emit to others in room
  socket.on('stop typing', (room) => socket.in(room).emit('stop typing', room));

  // Handle new message
  socket.on('new message', (newMessageReceived) => {
    console.log('New message received via socket:', newMessageReceived);
    
    // Get the chat ID from the message
    const chatId = newMessageReceived.chat;
    
    if (!chatId) {
      console.log('Chat ID not found in message:', newMessageReceived);
      return;
    }

    // Emit to all users in the chat room
    socket.to(chatId).emit('message received', newMessageReceived);
    console.log('Message emitted to chat room:', chatId);
  });
  
  // Handle message edit
  socket.on('edit message', (editedMessage) => {
    console.log('Message edit received via socket:', editedMessage);
    
    const chatId = editedMessage.chat;
    if (!chatId) {
      console.log('Chat ID not found in edited message:', editedMessage);
      return;
    }

    // Emit to all users in the chat room except sender
    socket.to(chatId).emit('message edited', editedMessage);
    console.log('Message edit emitted to chat room:', chatId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});