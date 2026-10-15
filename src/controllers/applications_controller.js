const applicationsService = require('../services/applications_service');
const asyncHandler = require('../utils/asyncHandler');

exports.apply = asyncHandler(async (req, res) => {
  const application = await applicationsService.applyToJob({
    jobId: req.params.id,
    candidateId: req.user.id, // from the token, never the body
    file: req.file,
  });
  res.status(201).json(application);
});

exports.my = asyncHandler(async (req, res) => {
  res.json(await applicationsService.getMyApplications(req.user.id));
});

exports.listForJob = asyncHandler(async (req, res) => {
  res.json(await applicationsService.getJobApplications(req.user.id, req.params.id));
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const application = await applicationsService.updateStatus(req.user.id, req.params.id, req.body.status);
  res.json(application);
});

exports.resume = asyncHandler(async (req, res) => {
  const filePath = await applicationsService.getResumePath(req.user, req.params.id);
  res.download(filePath);
});

exports.withdraw = asyncHandler(async (req, res) => {
  res.json(await applicationsService.withdrawApplication(req.user.id, req.params.id));
});