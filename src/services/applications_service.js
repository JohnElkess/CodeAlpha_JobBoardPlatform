const fs = require('fs/promises');
const path = require('path');
const Job = require('../models/Job');
const Application = require('../models/Application');
const AppError = require('../utils/AppError');

async function applyToJob({ jobId, candidateId, file }) {
  try {
    const job = await Job.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    if (job.status !== 'OPEN') throw new AppError('This job is closed', 400);

    return await Application.create({
      job: job._id,
      candidate: candidateId,
      resumePath: path.posix.join('uploads', 'resumes', file.filename), // relative path, portable across machines/containers
    });
  } catch (err) {
    // multer already wrote the file to disk, so remove it if the application failed
    await fs.unlink(file.path).catch(() => {});
    if (err.code === 11000) throw new AppError('You have already applied to this job', 409);
    throw err;
  }
}

async function getMyApplications(candidateId) {
  return Application.find({ candidate: candidateId })
    .populate({
      path: 'job',
      select: 'title location jobType status',
      populate: { path: 'employer', select: 'profile.companyName' },
    })
    .sort({ createdAt: -1 });
}

async function getJobApplications(employerId, jobId) {
  const job = await Job.findById(jobId);
  if (!job) throw new AppError('Job not found', 404);
  if (job.employer.toString() !== employerId) throw new AppError('Forbidden', 403); // ownership check

  return Application.find({ job: jobId })
    .populate('candidate', 'email profile.name profile.phone')
    .sort({ createdAt: -1 });
}

async function updateStatus(employerId, applicationId, status) {
  const application = await Application.findById(applicationId)
    .populate('job', 'employer title')
    .populate('candidate', 'email profile.name'); // needed for the email in Step 13
  if (!application) throw new AppError('Application not found', 404);
  if (application.job.employer.toString() !== employerId) throw new AppError('Forbidden', 403);

  application.status = status;
  await application.save();
  return application;
}

async function getResumePath(user, applicationId) {
  const application = await Application.findById(applicationId).populate('job', 'employer');
  if (!application) throw new AppError('Application not found', 404);

  const isApplicant = application.candidate.toString() === user.id;
  const isJobOwner = application.job.employer.toString() === user.id;
  if (!isApplicant && !isJobOwner) throw new AppError('Forbidden', 403);

  const absolute = path.join(__dirname, '../..', application.resumePath);
  await fs.access(absolute).catch(() => {
    throw new AppError('Resume file not found', 404);
  });
  return absolute;
}

module.exports = { applyToJob, getMyApplications, getJobApplications, updateStatus, getResumePath };