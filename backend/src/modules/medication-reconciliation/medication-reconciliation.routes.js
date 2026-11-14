const express = require('express');
const z = require('zod');
const Patient = require('../../models/Patient');
const MedicationReconciliation = require('../../models/MedicationReconciliation');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const reconciliationSchema = z.object({
  patientId: z.string().trim().min(1),
  medicationName: z.string().trim().min(1),
  existingMedicationInfo: z.string().trim().min(1),
  reviewOutcome: z.enum(['Reconciled', 'Discrepancy Identified', 'Unable to Confirm']),
  discrepancies: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filter = req.query.patientId
      ? { patientId: String(req.query.patientId).trim() }
      : {};
    const records = await MedicationReconciliation.find(filter)
      .sort({ dateTime: -1 })
      .limit(200);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole(['nurse', 'prescriber', 'pharmacist', 'medication_admin']), async (req, res, next) => {
  try {
    const parsed = reconciliationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication reconciliation record.',
        errors: parsed.error.issues.map(({ path, message }) => ({ path, message }))
      });
    }

    const payload = parsed.data;
    if (payload.reviewOutcome === 'Discrepancy Identified' && !payload.discrepancies) {
      return res.status(400).json({
        success: false,
        message: 'Describe the discrepancy before saving this reconciliation.'
      });
    }

    const patient = await Patient.findOne({ patientId: payload.patientId }).select('patientId');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });

    const record = await MedicationReconciliation.create({
      ...payload,
      responsibleUserId: req.session.user.id,
      dateTime: new Date()
    });
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_RECONCILIATION',
      module: 'medication-reconciliation',
      details: `Recorded ${payload.reviewOutcome.toLowerCase()} medication reconciliation`,
      req
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
