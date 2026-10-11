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

module.exports = { applyToJob };