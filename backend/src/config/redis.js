const { createClient } = require("redis");

let redisClient = null;
let redisReady = false;

async function connectRedis() {
  if (process.env.REDIS_ENABLED !== "true") {
    console.log("Redis disabled via env");
    return null;
  }

  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        reconnectStrategy: false // IMPORTANT: don't retry forever
      }
    });

    redisClient.on("ready", () => {
      redisReady = true;
      console.log("Redis ready");
    });

    redisClient.on("end", () => {
      redisReady = false;
      console.warn("Redis connection closed");
    });

    redisClient.on("error", (err) => {
      redisReady = false;
      console.warn("Redis error (ignored):", err.message);
    });

    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn("Redis unavailable at startup");
    redisClient = null;
    redisReady = false;
    return null;
  }
}

function getRedisClient() {
  if (!redisClient || !redisReady) return null;
  return redisClient;
}

module.exports = {
  connectRedis,
  getRedisClient
};
