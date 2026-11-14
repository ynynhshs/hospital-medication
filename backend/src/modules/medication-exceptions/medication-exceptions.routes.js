const express = require('express');
const z = require('zod');
const MedicationException = require('../../models/MedicationException');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ID is required.');
const exceptionSchema = z.object({
  patientId: z.string().trim().min(1),
  medicationName: z.string().trim().min(1),
  orderNumber: z.string().optional(),
  scheduledDose: z.coerce.date().optional(),
  exceptionType: z.enum(['Delayed', 'Missed', 'Refused', 'Withheld', 'Omitted']),
  reason: z.string().trim().min(1),
  followUpNotes: z.string().optional()
});
const reviewSchema = z.object({ followUpNotes: z.string().trim().optional() });

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.patientId) filter.patientId = String(req.query.patientId).trim();
    if (req.query.reviewStatus) {
      const reviewStatus = String(req.query.reviewStatus);
      if (!['Open', 'Reviewed'].includes(reviewStatus)) {
        return res.status(400).json({ success: false, message: 'reviewStatus must be Open or Reviewed.' });
      }
      filter.reviewStatus = reviewStatus;
    }

    const records = await MedicationException.find(filter).sort({ dateTime: -1 }).limit(200);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole(['nurse', 'medication_admin', 'pharmacist']), async (req, res, next) => {
  try {
    const parsed = exceptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication exception.',
        errors: parsed.error.issues.map(({ path, message }) => ({ path, message }))
      });
    }

    const payload = parsed.data;
    const record = await MedicationException.create({
      ...payload,
      documentedBy: req.session.user.id,
      dateTime: new Date(),
      reviewStatus: 'Open'
    });
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_EXCEPTION',
      module: 'medication-exceptions',
      details: `Recorded ${payload.exceptionType.toLowerCase()} medication exception`,
      req
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/review', requireAuth, requireRole(['medication_admin', 'pharmacist']), async (req, res, next) => {
  try {
    if (!objectIdSchema.safeParse(req.params.id).success) {
      return res.status(400).json({ success: false, message: 'A valid medication exception ID is required.' });
    }
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication exception review.',
        errors: parsed.error.issues.map(({ path, message }) => ({ path, message }))
      });
    }

    const update = {
      reviewStatus: 'Reviewed',
      reviewedBy: req.session.user.id,
      reviewedAt: new Date()
    };
    if (parsed.data.followUpNotes) update.followUpNotes = parsed.data.followUpNotes;

    const record = await MedicationException.findOneAndUpdate(
      { _id: req.params.id, reviewStatus: 'Open' },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!record) {
      const exists = await MedicationException.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ success: false, message: 'Medication exception not found.' });
      return res.status(409).json({ success: false, message: 'This medication exception has already been reviewed.' });
    }

    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_EXCEPTION_REVIEW',
      module: 'medication-exceptions',
      details: `Reviewed ${record.exceptionType.toLowerCase()} medication exception`,
      req
    });

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
