const authService = require('../services/auth_service');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => {
  const { email, password, role, profile } = req.body; // pick fields explicitly
  const result = await authService.register({ email, password, role, profile });
  res.status(201).json(result);
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});