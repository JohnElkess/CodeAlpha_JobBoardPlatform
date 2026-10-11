const jobsService = require('../services/jobs_service');
const asyncHandler = require('../utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
  const job = await jobsService.createJob(req.user.id, req.body); // employer comes from the token, never the body
  res.status(201).json(job);
});

exports.list = asyncHandler(async (req, res) => {
  res.json(await jobsService.listJobs(req.query));
});

exports.getOne = asyncHandler(async (req, res) => {
  res.json(await jobsService.getJobById(req.params.id));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await jobsService.updateJob(req.user.id, req.params.id, req.body));
});

exports.remove = asyncHandler(async (req, res) => {
  await jobsService.deleteJob(req.user.id, req.params.id);
  res.status(204).send(); // success, no body
});

exports.mine = asyncHandler(async (req, res) => {
  res.json(await jobsService.getEmployerJobs(req.user.id));
});