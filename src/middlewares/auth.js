const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// Link 1: who are you?
function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError('Authentication required', 401));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

// Link 2: are you allowed? Returns a middleware configured with the allowed roles
const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError('Forbidden', 403));

module.exports = { authenticate, authorize };