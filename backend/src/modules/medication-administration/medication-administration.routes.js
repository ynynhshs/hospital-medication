const crypto = require('node:crypto');
const express = require('express');
const z = require('zod');
const MedicationAdministration = require('../../models/MedicationAdministration');
const MedicationSchedule = require('../../models/MedicationSchedule');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationException = require('../../models/MedicationException');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ID is required.');
const adminSchema = z.object({
  orderId: objectIdSchema,
  scheduleId: objectIdSchema.optional(),
  patientId: z.string().trim().min(1),
  admissionReference: z.string().optional(),
  medicationName: z.string().trim().min(1),
  prescribedDose: z.string().optional(),
  actualDose: z.string().trim().optional(),
  doseUnit: z.string().trim().optional(),
  route: z.string().trim().optional(),
  scheduledDateTime: z.coerce.date().optional(),
  actualAdministrationTime: z.coerce.date().optional(),
  status: z.enum(['Administered', 'Delayed', 'Withheld', 'Refused', 'Omitted', 'Missed']),
  notes: z.string().optional(),
  exceptionReason: z.string().trim().optional(),
  patientResponse: z.string().optional()
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const records = await MedicationAdministration.find().sort({ actualAdministrationTime: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

router.post('/record', requireAuth, requireRole(['nurse', 'medication_admin', 'pharmacist']), async (req, res, next) => {
  try {
    const parsed = adminSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication administration record.',
        errors: parsed.error.issues.map(({ path, message }) => ({ path, message }))
      });
    }

    const payload = parsed.data;
    const order = await MedicationOrder.findById(payload.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Medication order not found.' });
    if (order.orderStatus !== 'Active' || order.verificationStatus !== 'Verified') {
      return res.status(409).json({ success: false, message: 'Only verified, active medication orders can be administered.' });
    }
    if (payload.patientId !== order.patientId || payload.medicationName !== order.medicationName) {
      return res.status(409).json({ success: false, message: 'Patient or medication does not match the verified order.' });
    }
    if (payload.prescribedDose && payload.prescribedDose !== order.prescribedDose) {
      return res.status(409).json({ success: false, message: 'Prescribed dose does not match the verified order.' });
    }
    if (payload.route && payload.route !== order.route) {
      return res.status(409).json({ success: false, message: 'Route does not match the verified order.' });
    }
    if (payload.doseUnit && payload.doseUnit !== order.doseUnit) {
      return res.status(409).json({ success: false, message: 'Dose unit does not match the verified order.' });
    }
    if (payload.status === 'Administered' && !payload.actualDose) {
      return res.status(400).json({ success: false, message: 'Actual dose is required when recording an administered dose.' });
    }
    if (payload.status !== 'Administered' && !payload.exceptionReason) {
      return res.status(400).json({ success: false, message: 'An exception reason is required when a dose is not administered.' });
    }
    if (payload.status !== 'Administered' && payload.actualAdministrationTime) {
      return res.status(400).json({ success: false, message: 'Actual administration time is only valid for an administered dose.' });
    }

    const actualAdministrationTime = payload.actualAdministrationTime || new Date();
    if (payload.status === 'Administered' && actualAdministrationTime > new Date()) {
      return res.status(400).json({ success: false, message: 'Actual administration time cannot be in the future.' });
    }

    let schedule = null;
    if (payload.scheduleId) {
      schedule = await MedicationSchedule.findById(payload.scheduleId);
      if (!schedule) return res.status(404).json({ success: false, message: 'Medication schedule not found.' });
      if (schedule.orderId.toString() !== order._id.toString() || schedule.patientId !== order.patientId) {
        return res.status(409).json({ success: false, message: 'Schedule does not match the verified order.' });
      }
      if (payload.scheduledDateTime && payload.scheduledDateTime.getTime() !== schedule.scheduledDateTime.getTime()) {
        return res.status(409).json({ success: false, message: 'Scheduled time does not match the medication schedule.' });
      }
      if (schedule.status === 'Administered') {
        return res.status(409).json({ success: false, message: 'This scheduled dose has already been administered.' });
      }
      if (payload.status === 'Administered') {
        const existingAdministration = await MedicationAdministration.findOne({
          scheduleId: schedule._id,
          status: 'Administered'
        });
        if (existingAdministration) {
          return res.status(409).json({ success: false, message: 'This scheduled dose has already been administered.' });
        }
      }
    } else if (!order.prnIndicator) {
      return res.status(400).json({ success: false, message: 'A schedule is required for a non-PRN medication order.' });
    } else if (payload.scheduledDateTime) {
      return res.status(400).json({ success: false, message: 'PRN administrations cannot reference a scheduled time.' });
    }

    let claimedSchedule = null;
    if (schedule && payload.status === 'Administered') {
      claimedSchedule = await MedicationSchedule.findOneAndUpdate(
        { _id: schedule._id, status: { $ne: 'Administered' } },
        { $set: { status: 'Administered' } },
        { new: true }
      );
      if (!claimedSchedule) {
        return res.status(409).json({ success: false, message: 'This scheduled dose has already been administered.' });
      }
    }

    let record;
    let exceptionRecord = null;
    try {
      record = await MedicationAdministration.create({
        recordNumber: `MAR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        orderId: order._id,
        scheduleId: schedule ? schedule._id : null,
        patientId: order.patientId,
        admissionReference: payload.admissionReference || order.admissionReference,
        medicationName: order.medicationName,
        prescribedDose: order.prescribedDose,
        actualDose: payload.actualDose || '',
        doseUnit: payload.doseUnit || order.doseUnit,
        route: order.route,
        scheduledDateTime: schedule ? schedule.scheduledDateTime : null,
        actualAdministrationTime: payload.status === 'Administered' ? actualAdministrationTime : null,
        status: payload.status,
        administeringUserId: req.session.user.id,
        notes: payload.notes || '',
        exceptionReason: payload.exceptionReason || '',
        patientResponse: payload.patientResponse || ''
      });
      if (payload.status !== 'Administered') {
        exceptionRecord = await MedicationException.create({
          orderId: order._id,
          scheduleId: schedule ? schedule._id : null,
          administrationId: record._id,
          patientId: order.patientId,
          medicationName: order.medicationName,
          orderNumber: order.orderNumber,
          scheduledDose: schedule ? schedule.scheduledDateTime : null,
          exceptionType: payload.status,
          reason: payload.exceptionReason,
          documentedBy: req.session.user.id,
          reviewStatus: 'Open'
        });
      }
    } catch (error) {
      if (exceptionRecord) await exceptionRecord.deleteOne();
      if (record) await record.deleteOne();
      if (claimedSchedule) {
        await MedicationSchedule.updateOne(
          {
            _id: claimedSchedule._id,
            status: 'Administered',
            relatedAdministrationId: schedule.relatedAdministrationId || null
          },
          { $set: { status: schedule.status } }
        );
      }
      throw error;
    }

    if (schedule) {
      try {
        const updatedSchedule = await MedicationSchedule.findOneAndUpdate(
          { _id: schedule._id, status: { $ne: 'Administered' } },
          { $set: { status: payload.status, relatedAdministrationId: record._id } },
          { new: true }
        );
        if (!updatedSchedule && payload.status !== 'Administered') {
          await record.deleteOne();
          if (exceptionRecord) await exceptionRecord.deleteOne();
          return res.status(409).json({ success: false, message: 'This scheduled dose has already been administered.' });
        }
        if (claimedSchedule) {
          await MedicationSchedule.updateOne(
            { _id: claimedSchedule._id, status: 'Administered' },
            { $set: { relatedAdministrationId: record._id } }
          );
        }
      } catch (error) {
        await record.deleteOne();
        if (exceptionRecord) await exceptionRecord.deleteOne();
        if (claimedSchedule) {
          await MedicationSchedule.updateOne(
            {
              _id: claimedSchedule._id,
              status: 'Administered',
              relatedAdministrationId: schedule.relatedAdministrationId || null
            },
            {
              $set: {
                status: schedule.status,
                relatedAdministrationId: schedule.relatedAdministrationId || null
              }
            }
          );
        }
        throw error;
      }
    }

    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_ADMINISTRATION',
      module: 'medication-administration',
      details: `Recorded ${payload.status.toLowerCase()} medication`,
      req
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
