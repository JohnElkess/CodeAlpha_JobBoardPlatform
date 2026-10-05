const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role }, // payload: keep it small
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

function toSafeUser(user) {
  const obj = user.toObject();
  delete obj.password; // select:false doesn't apply to a freshly created doc
  return obj;
}

async function register({ email, password, role, profile }) {
  try {
    const user = await User.create({ email, password, role, profile });
    return { user: toSafeUser(user), token: signToken(user) };
  } catch (err) {
    if (err.code === 11000) throw new AppError('Email already registered', 409);
    throw err;
  }
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');
  // Same message for "no such user" and "wrong password" so attackers can't probe which emails exist
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  return { user: toSafeUser(user), token: signToken(user) };
}

module.exports = { register, login };