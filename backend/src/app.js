const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { connectMongoDB, connectRedis } = require('../config/database');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Connect to databases
connectMongoDB();
connectRedis();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Muditha API', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'Muditha API is running!', 
    timestamp: new Date().toISOString(),
    database: 'Connected'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Muditha backend running on port ${PORT}`);
});

module.exports = app;