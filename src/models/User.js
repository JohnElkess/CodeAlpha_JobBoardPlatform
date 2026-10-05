const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never returned by queries unless explicitly requested
    },
    role: {
      type: String,
      enum: ['CANDIDATE', 'EMPLOYER'],
      required: true,
    },
    profile: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true },
      companyName: { type: String, trim: true },
      companyDescription: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

// Hash the password before saving, only if it was set or changed
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method used at login
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);