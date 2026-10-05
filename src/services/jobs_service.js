const Job = require('../models/Job');
const AppError = require('../utils/AppError');

// Escape user input before using it in a regex, so "c++" or ".*" can't break or abuse the query
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function createJob(employerId, data) {
  const { title, description, location, jobType, salaryRange } = data; // explicit fields only
  return Job.create({ employer: employerId, title, description, location, jobType, salaryRange });
}

async function listJobs({ q, location, jobType, page, limit }) {
  const filter = { status: 'OPEN' };

  // String(...) blocks NoSQL injection like ?jobType[$ne]=x, which Express parses into an object
  if (q) filter.$text = { $search: String(q) };
  if (location) filter.location = { $regex: escapeRegex(String(location)), $options: 'i' };
  if (jobType) filter.jobType = String(jobType);

  const p = Math.max(parseInt(page) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit) || 10, 1), 50); // cap page size at 50

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .populate('employer', 'profile.name profile.companyName')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    Job.countDocuments(filter),
  ]);

  return { jobs, page: p, limit: l, total, pages: Math.ceil(total / l) };
}

async function getJobById(id) {
  const job = await Job.findById(id).populate('employer', 'profile.name profile.companyName');
  if (!job) throw new AppError('Job not found', 404);
  return job;
}

module.exports = { createJob, listJobs, getJobById };