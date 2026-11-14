const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  collection: 'settings',
  versionKey: false,
  timestamps: true
});

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema, 'settings');
module.exports = Setting;
