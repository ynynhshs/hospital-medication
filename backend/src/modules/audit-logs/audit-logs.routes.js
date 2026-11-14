const express = require('express');
const AuditLog = require('../../models/AuditLog');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole(['medication_admin', 'medication_auditor']), async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
