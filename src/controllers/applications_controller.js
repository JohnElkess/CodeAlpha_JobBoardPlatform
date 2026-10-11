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