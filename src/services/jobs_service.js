const mongoose = require('mongoose');
const Application = require('../models/Application');
const Job = require('../models/Job');
const AppError = require('../utils/AppError');

// Escape user input before using it in a regex, so "c++" or ".*" can't break or abuse the query
const escapeRegex = require('../utils/escape_regex');


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

// Shared by update and delete: load the job and enforce ownership
async function getOwnedJob(employerId, jobId) {
  const job = await Job.findById(jobId);
  if (!job) throw new AppError('Job not found', 404);
  if (job.employer.toString() !== employerId) throw new AppError('Forbidden', 403);
  return job;
}

const UPDATABLE = ['title', 'description', 'location', 'jobType', 'salaryRange', 'status'];

async function updateJob(employerId, jobId, data) {
  const job = await getOwnedJob(employerId, jobId);
  for (const field of UPDATABLE) {          // whitelist: "employer" can never be reassigned
    if (data[field] !== undefined) job[field] = data[field];
  }
  await job.save();                          // runs schema validation
  return job;
}

async function deleteJob(employerId, jobId) {
  const job = await getOwnedJob(employerId, jobId);
  if (await Application.exists({ job: job._id })) {
    throw new AppError('This job has applications. Close it instead of deleting it', 409);
  }
  await job.deleteOne();
}

async function getEmployerJobs(employerId) {
  const STATUSES = Application.schema.path('status').enumValues;

  // One counting expression per status: how many of this job's applications have that status
  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [
      s,
      { $size: { $filter: { input: '$apps', as: 'a', cond: { $eq: ['$$a.status', s] } } } },
    ])
  );

  return Job.aggregate([
    { $match: { employer: new mongoose.Types.ObjectId(employerId) } },
    { $lookup: { from: 'applications', localField: '_id', foreignField: 'job', as: 'apps' } },
    { $addFields: { applicationCount: { $size: '$apps' }, statusCounts } },
    { $project: { apps: 0, description: 0 } },
    { $sort: { createdAt: -1 } },
  ]);
}

module.exports = { createJob, listJobs, getJobById, updateJob, deleteJob, getEmployerJobs };