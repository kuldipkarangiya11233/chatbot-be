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

// Mount Routes
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);


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
    var chat = newMessageReceived.chat;

    if (!chat.users) return console.log('Chat.users not defined for message:', newMessageReceived);

    // Emit to all users in the chat room, including the sender
    chat.users.forEach(user => {
      // Emit to the specific user's room (if they are connected)
      // The client-side logic will handle displaying the message appropriately.
      io.to(user._id).emit('message received', newMessageReceived);
    });
  });
  
  // Handle message edit
  socket.on('edit message', (editedMessage) => {
    var chat = editedMessage.chat;
    if (!chat || !chat.users) return console.log('Chat or Chat.users not defined for edited message:', editedMessage);

    chat.users.forEach(user => {
        // Emit to all users in the chat including sender to update their UI
        socket.to(user._id).emit('message edited', editedMessage);
    });
  });


  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // TODO: Handle cleanup if user leaves rooms, etc.
    // For example, if we stored which room user was in:
    // socket.leave(userData._id); // This would need userData to be available here
  });
});