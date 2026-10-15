const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escape_regex');

const enumsOf = (Model, field) => Model.schema.path(field).enumValues;
const groupBy = (Model, field) => Model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

// [{_id:'OPEN', count:3}] -> {OPEN:3, CLOSED:0}, so every known value appears even at zero
function toCounts(rows, keys) {
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

async function getStats() {
  const [roleRows, jobRows, appRows, inactiveUsers, last7Days, last30Days, topJobs] = await Promise.all([
    groupBy(User, 'role'),
    groupBy(Job, 'status'),
    groupBy(Application, 'status'),
    User.countDocuments({ isActive: false }),
    Application.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
    Application.countDocuments({ createdAt: { $gte: daysAgo(30) } }),
    Application.aggregate([
      { $group: { _id: '$job', applications: { $sum: 1 } } },
      { $sort: { applications: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
      { $project: { _id: 0, jobId: '$_id', title: '$job.title', location: '$job.location', applications: 1 } },
    ]),
  ]);

  const byRole = toCounts(roleRows, enumsOf(User, 'role'));
  const jobsByStatus = toCounts(jobRows, enumsOf(Job, 'status'));
  const appsByStatus = toCounts(appRows, enumsOf(Application, 'status'));

  return {
    users: { total: sum(byRole), active: sum(byRole) - inactiveUsers, inactive: inactiveUsers, byRole },
    jobs: { total: sum(jobsByStatus), byStatus: jobsByStatus },
    applications: { total: sum(appsByStatus), byStatus: appsByStatus, last7Days, last30Days },
    topJobs,
  };
}

async function listUsers({ role, q, isActive, page, limit }) {
  const filter = {};
  if (role) filter.role = String(role); // String() blocks operator injection like ?role[$ne]=x
  if (isActive === 'true') filter.isActive = { $ne: false }; // users without the field count as active
  if (isActive === 'false') filter.isActive = false;
  if (q) {
    const rx = { $regex: escapeRegex(String(q)), $options: 'i' };
    filter.$or = [{ email: rx }, { 'profile.name': rx }];
  }

  const p = Math.max(parseInt(page) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l), // password is select:false
    User.countDocuments(filter),
  ]);
  return { users, page: p, limit: l, total, pages: Math.ceil(total / l) };
}

async function setUserActive(userId, isActive) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (!isActive && user.role === 'ADMIN') throw new AppError('Admin accounts cannot be deactivated', 403);

  const updated = await User.findByIdAndUpdate(userId, { isActive }, { new: true });

  if (!isActive && user.role === 'EMPLOYER') {
    // A blocked employer's jobs must not stay searchable
    await Job.updateMany({ employer: user._id, status: 'OPEN' }, { status: 'CLOSED' });
  }
  return updated;
}

module.exports = { getStats, listUsers, setUserActive };