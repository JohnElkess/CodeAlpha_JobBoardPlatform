const AppError = require('../utils/AppError');
const Job = require('../models/Job');

const JOB_TYPES = Job.schema.path('jobType').enumValues; // reuse the model's enum, no duplication

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

function validateJob(req, res, next) {
  const { title, description, location, jobType, salaryRange } = req.body;
  if (!title?.trim()) return next(new AppError('title is required', 400));
  if (!description?.trim()) return next(new AppError('description is required', 400));
  if (!location?.trim()) return next(new AppError('location is required', 400));
  if (!JOB_TYPES.includes(jobType)) {
    return next(new AppError(`jobType must be one of: ${JOB_TYPES.join(', ')}`, 400));
  }
  if (salaryRange?.min != null && salaryRange?.max != null && salaryRange.min > salaryRange.max) {
    return next(new AppError('salaryRange.min cannot exceed salaryRange.max', 400));
  }
  next();
}

module.exports = { validateRegister, validateLogin, validateJob };