const crypto = require("crypto");

/**
 * Hash a quit password using SHA-256 + userId as salt.
 * Simple but sufficient — this isn't user authentication,
 * it's friction to prevent impulsive app-quitting.
 */
function hashQuitPassword(password, userId) {
  return crypto
    .createHash("sha256")
    .update(password + ":" + userId)
    .digest("hex");
}

module.exports = { hashQuitPassword };
