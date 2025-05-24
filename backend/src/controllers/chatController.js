const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

// Import AI services
const geminiService = require('../services/ai/geminiService');
const sentimentService = require('../services/ai/sentimentService');
const crisisDetection = require('../services/ai/crisisDetection');

// Create a new chat room
const createChatRoom = async (req, res) => {
  try {
    const { name, description, type, participants = [], settings = {} } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Name and type are required'
      });
    }

    // Add creator as first participant with admin role
    const roomParticipants = [{
      user: userId,
      role: 'admin',
      joinedAt: new Date(),
      isActive: true
    }];

    // Add other participants if provided
    if (participants.length > 0) {
      const validParticipants = await User.find({
        _id: { $in: participants },
        isActive: true
      });

      validParticipants.forEach(participant => {
        if (participant._id.toString() !== userId.toString()) {
          roomParticipants.push({
            user: participant._id,
            role: 'member',
            joinedAt: new Date(),
            isActive: true
          });
        }
      });
    }

    // Create chat room
    const chatRoom = new ChatRoom({
      name,
      description,
      type,
      participants: roomParticipants,
      settings: {
        isPrivate: settings.isPrivate || false,
        allowAnonymous: settings.allowAnonymous || false,
        maxParticipants: settings.maxParticipants || 50,
        aiModeration: settings.aiModeration !== undefined ? settings.aiModeration : true,
        crisisDetection: settings.crisisDetection !== undefined ? settings.crisisDetection : true
      },
      aiAssistant: {
        isEnabled: type === 'ai_chat' || settings.aiEnabled || false,
        personality: settings.aiPersonality || 'supportive',
        specialization: settings.aiSpecialization || []
      },
      createdBy: userId
    });

    await chatRoom.save();
    await chatRoom.populate('participants.user', 'profile email');

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: {
        chatRoom: {
          _id: chatRoom._id,
          name: chatRoom.name,
          description: chatRoom.description,
          type: chatRoom.type,
          participants: chatRoom.participants,
          settings: chatRoom.settings,
          aiAssistant: chatRoom.aiAssistant,
          createdAt: chatRoom.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat room'
    });
  }
};

// Get user's chat rooms
const getUserChatRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;

    const query = {
      'participants.user': userId,
      'participants.isActive': true,
      isActive: true
    };

    if (type) {
      query.type = type;
    }

    const chatRooms = await ChatRoom.find(query)
      .populate('participants.user', 'profile email')
      .populate('createdBy', 'profile email')
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ChatRoom.countDocuments(query);

    res.json({
      success: true,
      data: {
        chatRooms,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error getting chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat rooms'
    });
  }
};

// Get chat room details
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const chatRoom = await ChatRoom.findById(roomId)
      .populate('participants.user', 'profile email')
      .populate('createdBy', 'profile email');

    if (!chatRoom || !chatRoom.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chatRoom.participants.some(
      p => p.user._id.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat room'
      });
    }

    res.json({
      success: true,
      data: { chatRoom }
    });

  } catch (error) {
    console.error('Error getting chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat room'
    });
  }
};

// Get chat room messages
const getChatRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    // Verify user has access to this room
    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom || !chatRoom.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    const isParticipant = chatRoom.participants.some(
      p => p.user.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat room'
      });
    }

    // Get messages
    const messages = await Message.find({
      chatRoom: roomId,
      isDeleted: false
    })
      .populate('sender', 'profile email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      chatRoom: roomId,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages'
    });
  }
};

// NEW: Send message with AI integration
const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text' } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify user has access to this room
    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom || !chatRoom.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    const isParticipant = chatRoom.participants.some(
      p => p.user.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat room'
      });
    }

    // Create user message
    const userMessage = new Message({
      chatRoom: roomId,
      sender: userId,
      content: content.trim(),
      type,
      createdAt: new Date()
    });

    await userMessage.save();
    await userMessage.populate('sender', 'profile email');

    // Update room last activity
    chatRoom.lastActivity = new Date();
    await chatRoom.save();

    // Emit user message to room
    if (req.io) {
      req.io.to(roomId).emit('newMessage', {
        _id: userMessage._id,
        content: userMessage.content,
        sender: userMessage.sender,
        type: userMessage.type,
        createdAt: userMessage.createdAt
      });
    }

    let aiResponse = null;

    // Generate AI response if AI is enabled for this room
    if (chatRoom.aiAssistant && chatRoom.aiAssistant.isEnabled) {
      try {
        // AI Analysis
        const sentiment = sentimentService.analyzeSentiment(content);
        const crisis = crisisDetection.assessCrisisRisk(content);
        const emotion = await geminiService.analyzeEmotionalState(content);

        // Get conversation history for context
        const recentMessages = await Message.find({
          chatRoom: roomId,
          isDeleted: false
        })
          .populate('sender', 'profile email')
          .sort({ createdAt: -1 })
          .limit(10);

        // Generate AI response
        let geminiResponse;
        if (crisis.requiresIntervention) {
          geminiResponse = {
            message: crisisDetection.generateCrisisResponse(crisis.riskLevel),
            model: 'crisis-intervention'
          };
        } else {
          const history = recentMessages.reverse().map(msg => ({
            role: msg.sender ? 'User' : 'Muditha',
            content: msg.content
          }));

          geminiResponse = await geminiService.generateResponse(content, history);
        }

        // Create a system user for AI messages (you may want to create this once and reuse)
        // For now, we'll create AI messages with a special sender ID or handle it differently
        let aiSenderId = null;

        // Option 1: Create a system user for AI (recommended)
        // You should create this user once in your database setup
        const systemUser = await User.findOne({ email: 'system@muditha.ai' });
        if (systemUser) {
          aiSenderId = systemUser._id;
        }

        // Save AI response as message
        // Alternative approach - modify the AI message creation part in sendMessage:

        // Save AI response as message (without system user)
        const aiMessage = new Message({
          chatRoom: roomId,
          // sender: null, // Remove this line - let the schema handle it
          content: geminiResponse.message,
          type: 'ai_response',
          metadata: {
            sentiment: {
              score: sentiment.score,
              comparative: sentiment.comparative,
              classification: sentiment.classification,
              positive: sentiment.positive,
              negative: sentiment.negative,
              timestamp: new Date()
            },
            emotion: emotion,
            crisis: {
              riskLevel: crisis.riskLevel,
              requiresIntervention: crisis.requiresIntervention,
              timestamp: new Date()
            },
            model: geminiResponse.model,
            timestamp: new Date(),
            isAiGenerated: true
          },
          createdAt: new Date()
        });

        // Don't populate sender for AI messages
        await aiMessage.save();

        // Emit AI response to room (without sender info)
        if (req.io) {
          req.io.to(roomId).emit('newMessage', {
            _id: aiMessage._id,
            content: aiMessage.content,
            sender: null,
            type: 'ai_response',
            metadata: aiMessage.metadata,
            createdAt: aiMessage.createdAt,
            isAI: true
          });
        }

        aiResponse = aiMessage;

      } catch (aiError) {
        console.error('AI response error:', aiError);
        // Continue without AI response if there's an error
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        userMessage,
        aiResponse
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Join a chat room
const joinChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom || !chatRoom.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Check if already a participant
    const existingParticipant = chatRoom.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (existingParticipant) {
      if (existingParticipant.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Already a member of this chat room'
        });
      } else {
        // Reactivate participant
        existingParticipant.isActive = true;
        existingParticipant.joinedAt = new Date();
      }
    } else {
      // Check room capacity
      const activeParticipants = chatRoom.participants.filter(p => p.isActive).length;
      if (activeParticipants >= chatRoom.settings.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Chat room is full'
        });
      }

      // Add new participant
      chatRoom.participants.push({
        user: userId,
        role: 'member',
        joinedAt: new Date(),
        isActive: true
      });
    }

    await chatRoom.save();

    res.json({
      success: true,
      message: 'Successfully joined chat room',
      data: { roomId }
    });

  } catch (error) {
    console.error('Error joining chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join chat room'
    });
  }
};

// Leave a chat room
const leaveChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    const participant = chatRoom.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (!participant || !participant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this chat room'
      });
    }

    // Deactivate participant instead of removing
    participant.isActive = false;
    await chatRoom.save();

    res.json({
      success: true,
      message: 'Successfully left chat room'
    });

  } catch (error) {
    console.error('Error leaving chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave chat room'
    });
  }
};

module.exports = {
  createChatRoom,
  getUserChatRooms,
  getChatRoom,
  getChatRoomMessages,
  sendMessage, // This is the new function
  joinChatRoom,
  leaveChatRoom
};