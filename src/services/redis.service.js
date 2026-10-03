const { Redis } = require("@upstash/redis");

let redis = null;

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  console.log("✅ Upstash Redis configured");
} else {
  console.warn(
    "⚠️ Upstash Redis credentials not configured. Using MongoDB only."
  );
}

/**
 * Get cached value.
 * Returns null if Redis is unavailable or key does not exist.
 */
const getCache = async (key) => {
  if (!redis) return null;

  try {
    return await redis.get(key);
  } catch (error) {
    console.error("⚠️ Redis GET failed:", error.message);
    return null;
  }
};

/**
 * Set cached value.
 * Redis failure must never break the API.
 */
const setCache = async (key, value, ttlSeconds = 60) => {
  if (!redis) return false;

  try {
    await redis.set(key, value, {
      ex: ttlSeconds,
    });

    return true;
  } catch (error) {
    console.error("⚠️ Redis SET failed:", error.message);
    return false;
  }
};

/**
 * Delete cached value.
 * Redis failure must never break the API.
 */
const deleteCache = async (key) => {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error("⚠️ Redis DELETE failed:", error.message);
    return false;
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
};