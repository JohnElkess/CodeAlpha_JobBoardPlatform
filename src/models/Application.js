const mongoose = require('mongoose');

const STATUSES = ['APPLIED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resumePath: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: 'APPLIED' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: STATUSES, required: true },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// A candidate can apply to a given job only once
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

// Record every status change: the initial APPLIED on creation, and each later change
applicationSchema.pre('save', function () {
  if (this.isNew || this.isModified('status')) {
    this.statusHistory.push({ status: this.status });
  }
});

module.exports = mongoose.model('Application', applicationSchema);