const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { connectMongoDB, connectRedis } = require('./config/database');
const { initializeSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Connect to databases
connectMongoDB();
connectRedis();

// Middleware
app.use(helmet());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Muditha API',
    version: '1.0.0',
    features: ['Authentication', 'Real-time Chat', 'AI Integration']
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'Muditha API is running!',
    timestamp: new Date().toISOString(),
    database: 'Connected',
    websocket: 'Active'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Handle 404 - FIXED: Remove the '*' pattern
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Muditha backend running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});

module.exports = { app, server, io };