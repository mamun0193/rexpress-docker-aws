const express = require('express');

const app = express();

// Middleware
app.use(express.json());

// Mock user data
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Developer' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Designer' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Manager' },
  { id: 4, name: 'Alice Williams', email: 'alice@example.com', role: 'Developer' },
  { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', role: 'DevOps' }
];

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is healthy' });
});

// Get all users
app.get('/api/users', (req, res) => {
  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});

module.exports = app;
