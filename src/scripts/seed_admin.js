require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error(`${email} already exists as a ${existing.role}. Use a different ADMIN_EMAIL`);
    }
    console.log('Admin already exists, nothing to do');
    return;
  }

  await User.create({ email, password, role: 'ADMIN', profile: { name: 'Administrator' } }); // model hook hashes it
  console.log(`Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());