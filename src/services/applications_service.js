const { events, EVENTS } = require('../events/emitter');
const fs = require('fs/promises');
const path = require('path');
const Job = require('../models/Job');
const Application = require('../models/Application');
const AppError = require('../utils/AppError');

async function applyToJob({ jobId, candidateId, file }) {
  let application;
  try {
    const job = await Job.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    if (job.status !== 'OPEN') throw new AppError('This job is closed', 400);

    application = await Application.create({
      job: job._id,
      candidate: candidateId,
      resumePath: path.posix.join('uploads', 'resumes', file.filename),
    });
  } catch (err) {
    await fs.unlink(file.path).catch(() => {});
    if (err.code === 11000) throw new AppError('You have already applied to this job', 409);
    throw err;
  }

  events.emit(EVENTS.APPLICATION_CREATED, { applicationId: application._id });
  return application;
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
  const application = await Application.findById(applicationId).populate('job', 'employer title');
  if (!application) throw new AppError('Application not found', 404);
  if (application.job.employer.toString() !== employerId) throw new AppError('Forbidden', 403);
  if (application.status === 'WITHDRAWN') throw new AppError('This application was withdrawn by the candidate', 409);

  if (application.status === status) return application; // no change, so no notification

  application.status = status;
  await application.save();

  events.emit(EVENTS.APPLICATION_STATUS_CHANGED, { applicationId: application._id });
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

async function withdrawApplication(candidateId, applicationId) {
  const application = await Application.findById(applicationId);
  if (!application) throw new AppError('Application not found', 404);
  if (application.candidate.toString() !== candidateId) throw new AppError('Forbidden', 403);

  if (!['APPLIED', 'IN_REVIEW'].includes(application.status)) {
    throw new AppError(`Cannot withdraw an application that is ${application.status}`, 409);
  }

  application.status = 'WITHDRAWN';
  await application.save(); // the model hook records the history entry
  return application;
}

module.exports = { applyToJob, getMyApplications, getJobApplications, updateStatus, getResumePath, withdrawApplication };