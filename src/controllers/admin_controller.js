const adminService = require('../services/admin_service');
const asyncHandler = require('../utils/asyncHandler');

exports.stats = asyncHandler(async (req, res) => {
  res.json(await adminService.getStats());
});

exports.users = asyncHandler(async (req, res) => {
  res.json(await adminService.listUsers(req.query));
});

exports.setActive = asyncHandler(async (req, res) => {
  res.json(await adminService.setUserActive(req.params.id, req.body.isActive));
});