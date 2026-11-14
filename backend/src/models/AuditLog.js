const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  Id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  username: { type: String, required: true },
  role: { type: String, required: true },
  action: { type: String, required: true },
  module: { type: String, required: true },
  Details: { type: String, default: '' },
  IP: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'auditlogs',
  versionKey: false
});

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema, 'auditlogs');
module.exports = AuditLog;
