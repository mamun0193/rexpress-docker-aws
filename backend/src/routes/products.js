const express = require("express");
const router = express.Router();
const { getRedisClient } = require("../config/redis");

router.get("/", async (req, res) => {
  const redis = getRedisClient();
  const cacheKey = "products:all";

  try {
    //  SAFE cache read
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json({
            source: "cache",
            data: JSON.parse(cached)
          });
        }
      } catch (err) {
        console.warn("Redis read failed, skipping cache");
      }
    }

    // Simulate DB delay
    await new Promise((r) => setTimeout(r, 1500));

    const products = [
      { id: 1, name: "Laptop" },
      { id: 2, name: "Phone" }
    ];

    // ✅ SAFE cache write
    if (redis) {
      try {
        await redis.setEx(cacheKey, 60, JSON.stringify(products));
      } catch (err) {
        console.warn("Redis write failed");
      }
    }

    res.json({
      source: "db",
      data: products
    });
  } catch (err) {
    console.error("Route failure:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;