const AppError = require('../utils/AppError');

function validateRegister(req, res, next) {
  const { email, password, role, profile } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return next(new AppError('Valid email is required', 400));
  if (!password || password.length < 6) return next(new AppError('Password must be at least 6 characters', 400));
  if (!['CANDIDATE', 'EMPLOYER'].includes(role)) return next(new AppError('Role must be CANDIDATE or EMPLOYER', 400));
  if (!profile?.name) return next(new AppError('profile.name is required', 400));
  next();
}

function validateLogin(req, res, next) {
  if (!req.body.email || !req.body.password) return next(new AppError('Email and password are required', 400));
  next();
}

module.exports = { validateRegister, validateLogin };