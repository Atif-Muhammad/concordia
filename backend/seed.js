require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

const seedSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/concordia_erp';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const email = 'super@gmail.com';
    const plainPassword = 'super123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.password = hashedPassword;
      existingUser.role = 'SUPER_ADMIN';
      existingUser.status = 'ACTIVE';
      existingUser.permissions = { all: true, modules: [], subModules: {} };
      await existingUser.save();
      console.log(`Updated existing super admin: ${email}`);
    } else {
      await User.create({
        name: 'Super Admin',
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: { all: true, modules: [], subModules: {} }
      });
      console.log(`Created new super admin: ${email}`);
    }

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seedSuperAdmin();
