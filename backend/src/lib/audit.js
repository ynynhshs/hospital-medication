const AuditLog = require('../models/AuditLog');

async function recordAudit({ username, role, action, module, details, req }) {
  if (!username && !role && !action) return null;
  try {
    return await AuditLog.create({
      username: username || 'system',
      role: role || 'system',
      action: action || 'UPDATE',
      module: module || 'system',
      Details: details || '',
      IP: req && req.ip ? req.ip : null,
      createdAt: new Date()
    });
  } catch (error) {
    return null;
  }
}

module.exports = { recordAudit };
