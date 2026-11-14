require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/password');

async function createAdmin() {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME || 'medilink_lab_dev';
    
    if (!uri) throw new Error("MONGODB_URI is missing from .env");
    
    await mongoose.connect(uri, { dbName });
    console.log(`Connected to ${dbName}...`);

    const existing = await User.findOne({ username: 'medadmin' });
    if (existing) {
      console.log('Admin account already exists!');
      process.exit(0);
    }

    await User.create({
      firstName: 'Medication',
      lastName: 'Administrator',
      employeeId: 'MED-00001',
      username: 'medadmin',
      email: 'medadmin@medilink.com',
      passwordHash: await hashPassword('Admin123!'),
      role: 'medication_admin',
      status: 'Active'
    });

    console.log('✅ Admin account created successfully!');
    console.log('Username: medadmin');
    console.log('Password: Admin123!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdmin();