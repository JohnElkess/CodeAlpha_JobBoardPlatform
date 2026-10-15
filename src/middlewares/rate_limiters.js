const { ipKeyGenerator } = require('express-rate-limit');
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

// Route the 429 through our error handler so the response keeps the same { message } shape
const handler = (req, res, next) => next(new AppError('Too many requests, please try again later', 429));

const base = {
  standardHeaders: 'draft-7', // sends RateLimit-* headers plus Retry-After when blocked
  legacyHeaders: false,       // no old X-RateLimit-* headers
  handler,
  skip: () => process.env.NODE_ENV === 'test', // so automated tests (Step 19) aren't throttled
};

// Whole API: generous, stops floods
const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300 });

// Login/register: strict, stops password guessing
const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase()}`,
});

module.exports = { apiLimiter, authLimiter };