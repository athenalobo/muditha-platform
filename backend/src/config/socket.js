const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const { redisClient } = require('./database');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Invalid user'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log(`User ${socket.user.email} connected with socket ID: ${socket.id}`);

    // Store user's socket ID in Redis for later use
    redisClient.setEx(`user_socket_${socket.userId}`, 3600, socket.id);

    // Join user to their personal room for direct notifications
    socket.join(`user_${socket.userId}`);

    // Handle joining a chat room
    socket.on('join_room', async (data) => {
      try {
        const { roomId } = data;
        
        // Verify user has access to this room
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
          socket.emit('error', { message: 'Chat room not found' });
          return;
        }

        // Check if user is a participant
        const isParticipant = chatRoom.participants.some(
          p => p.user.toString() === socket.userId && p.isActive
        );

        if (!isParticipant) {
          socket.emit('error', { message: 'Access denied to this chat room' });
          return;
        }

        // Leave previous rooms (except personal room)
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room !== socket.id && !room.startsWith('user_')) {
            socket.leave(room);
          }
        });

        // Join the new room
        socket.join(roomId);
        
        // Notify others in the room
        socket.to(roomId).emit('user_joined', {
          userId: socket.userId,
          username: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`,
          timestamp: new Date()
        });

        // Send confirmation to the user
        socket.emit('room_joined', {
          roomId,
          roomName: chatRoom.name,
          participants: chatRoom.participants.length
        });

        console.log(`User ${socket.user.email} joined room ${roomId}`);

      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content, messageType = 'text' } = data;

        // Validate input
        if (!roomId || !content || content.trim().length === 0) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        // Verify user is in the room
        if (!socket.rooms.has(roomId)) {
          socket.emit('error', { message: 'You are not in this room' });
          return;
        }

        // Create and save message
        const message = new Message({
          chatRoom: roomId,
          sender: socket.userId,
          content: content.trim(),
          messageType
        });

        await message.save();

        // Populate sender info
        await message.populate('sender', 'profile email');

        // Update chat room's last activity and message count
        await ChatRoom.findByIdAndUpdate(roomId, {
          lastActivity: new Date(),
          $inc: { messageCount: 1 }
        });

        // Prepare message data for broadcasting
        const messageData = {
          _id: message._id,
          content: message.content,
          messageType: message.messageType,
          sender: {
            _id: message.sender._id,
            name: `${message.sender.profile.firstName} ${message.sender.profile.lastName}`,
            email: message.sender.email
          },
          createdAt: message.createdAt,
          roomId
        };

        // Broadcast message to all users in the room
        io.to(roomId).emit('new_message', messageData);

        // TODO: Here we'll add AI analysis and crisis detection
        // For now, just log for development
        console.log(`Message sent in room ${roomId} by ${socket.user.email}: ${content}`);

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { roomId } = data;
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit('user_typing', {
          userId: socket.userId,
          username: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { roomId } = data;
      if (socket.rooms.has(roomId)) {
        socket.to(roomId).emit('user_stopped_typing', {
          userId: socket.userId
        });
      }
    });

    // Handle message read receipts
    socket.on('mark_message_read', async (data) => {
      try {
        const { messageId } = data;
        
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: {
            readBy: {
              user: socket.userId,
              readAt: new Date()
            }
          }
        });

        // Notify sender that message was read
        const message = await Message.findById(messageId).populate('sender');
        const senderSocketId = await redisClient.get(`user_socket_${message.sender._id}`);
        
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_read', {
            messageId,
            readBy: socket.userId,
            readAt: new Date()
          });
        }

      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.email} disconnected`);
      
      // Remove socket ID from Redis
      await redisClient.del(`user_socket_${socket.userId}`);
      
      // Notify rooms about user leaving
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && !room.startsWith('user_')) {
          socket.to(room).emit('user_left', {
            userId: socket.userId,
            username: `${socket.user.profile.firstName} ${socket.user.profile.lastName}`,
            timestamp: new Date()
          });
        }
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};