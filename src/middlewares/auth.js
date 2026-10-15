const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const User = require('../models/User');


// Link 1: who are you?
async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError('Authentication required', 401));

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }

  try {
    // One lookup per request: deactivation and role changes apply immediately, not at token expiry
    const user = await User.findById(payload.id).select('role isActive');
    if (!user) return next(new AppError('Account no longer exists', 401));
    if (user.isActive === false) return next(new AppError('Account is deactivated', 403));
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Link 2: are you allowed? Returns a middleware configured with the allowed roles
const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError('Forbidden', 403));

module.exports = { authenticate, authorize };