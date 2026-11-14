const express = require('express');
const z = require('zod');
const Setting = require('../../models/Setting');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const settingsSchema = z.object({
  hospitalName: z.string().trim().min(1).max(200).optional(),
  contactInfo: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch (error) {
      if (error instanceof RangeError) return false;
      throw error;
    }
  }, 'Invalid timezone.').optional(),
  delayWarningThreshold: z.number().int().min(0).optional(),
  missedDoseReviewThreshold: z.number().int().min(0).optional(),
  doseReminderLeadMinutes: z.number().int().min(0).max(1440).optional()
}).strict().refine((payload) => Object.keys(payload).length > 0, 'At least one setting is required.');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const settings = await Setting.find();
    const object = settings.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    res.json({ success: true, data: object });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole(['medication_admin']), async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
    }
    const saved = [];
    for (const [key, value] of Object.entries(parsed.data)) {
      const result = await Setting.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true });
      saved.push(result);
    }
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'SETTINGS_UPDATE',
      module: 'settings',
      details: `Updated facility settings: ${Object.keys(parsed.data).join(', ')}`,
      req
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
