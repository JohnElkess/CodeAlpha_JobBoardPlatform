const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resumePath: { type: String, required: true },
    status: {
      type: String,
      enum: ['APPLIED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'],
      default: 'APPLIED',
    },
  },
  { timestamps: true }
);

// A candidate can apply to a given job only once
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);