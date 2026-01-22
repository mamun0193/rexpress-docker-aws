const express = require("express");
require("dotenv").config();
const { connectRedis } = require("./config/redis");
const productsRouter = require("./routes/products");
const app = express();

// Middleware
app.use(express.json());

//Redis Connection
(async () => {
  try {
    await connectRedis();
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
})();

// Global error handlers

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (ignored):", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});


// Mock user data
const users = [
  { id: 1, name: "John Doe", email: "john@example.com", role: "Developer" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", role: "Designer" },
  { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "Manager" },
  {
    id: 4,
    name: "Alice Williams",
    email: "alice@example.com",
    role: "Developer",
  },
  {
    id: 5,
    name: "Charlie Brown",
    email: "charlie@example.com",
    role: "DevOps",
  },
];
// Routes
app.use("/api/products", productsRouter);


// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Backend is healthy" });
});

// Get all users
app.get("/api/users", (req, res) => {
  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

module.exports = app;
