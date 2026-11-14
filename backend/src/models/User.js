const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, default: 'nurse' },
  status: { type: String, trim: true },
  Status: { type: String, trim: true },
  updateAt: { type: Date }
}, {
  collection: 'users',
  timestamps: true
});

const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');
module.exports = User;
