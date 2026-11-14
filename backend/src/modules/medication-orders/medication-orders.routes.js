const express = require('express');
const z = require('zod');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationSchedule = require('../../models/MedicationSchedule');
const Patient = require('../../models/Patient');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'A valid medication order ID is required.');
const closedOrderStatuses = ['Discontinued', 'Completed', 'Cancelled'];
const orderSchema = z.object({
  patientId: z.string().min(1),
  medicationCatalogId: z.string().optional(),
  medicationName: z.string().min(1),
  brandName: z.string().optional(),
  strength: z.string().optional(),
  dosageForm: z.string().optional(),
  prescribedDose: z.string().min(1),
  doseUnit: z.string().optional(),
  route: z.string().optional(),
  frequency: z.string().min(1),
  administrationSchedule: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  prnIndicator: z.boolean().optional(),
  prnIndication: z.string().optional(),
  authorizedInstructions: z.string().optional(),
  clinicalNotes: z.string().optional(),
  admissionReference: z.string().optional()
}).strict().superRefine((payload, context) => {
  if (payload.endDate && payload.endDate < payload.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'The order end date cannot be before its start date.'
    });
  }
});

function validateOrderId(req, res, next) {
  if (!objectIdSchema.safeParse(req.params.id).success) {
    return res.status(400).json({ success: false, message: 'A valid medication order ID is required.' });
  }
  next();
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const orders = await MedicationOrder.find().sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, validateOrderId, async (req, res, next) => {
  try {
    const order = await MedicationOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole(['prescriber', 'medication_admin', 'pharmacist']), async (req, res, next) => {
  try {
    const payload = orderSchema.parse(req.body);
    if (payload.prnIndicator && !payload.prnIndication?.trim()) {
      return res.status(400).json({ success: false, message: 'A PRN indication is required for as-needed medication orders.' });
    }

    const patient = await Patient.findOne({ patientId: payload.patientId });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const orderNumber = `MED-${Date.now()}`;
    const order = await MedicationOrder.create({
      ...payload,
      orderNumber,
      patientName: `${patient.firstName} ${patient.lastName}`,
      prescriberUserId: req.session.user.id,
      prescriberName: req.session.user.username,
      verificationStatus: 'Pending Verification',
      orderStatus: 'Pending Verification',
      orderDate: new Date()
    });
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_ORDER_CREATED',
      module: 'medication-orders',
      details: `Created medication order ${order.orderNumber}`,
      req
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/verify', requireAuth, requireRole(['pharmacist', 'medication_admin']), validateOrderId, async (req, res, next) => {
  try {
    const order = await MedicationOrder.findOneAndUpdate(
      {
        _id: req.params.id,
        orderStatus: 'Pending Verification',
        verificationStatus: 'Pending Verification'
      },
      { $set: { verificationStatus: 'Verified', orderStatus: 'Active' } },
      { new: true, runValidators: true }
    );
    if (!order) {
      const exists = await MedicationOrder.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ success: false, message: 'Order not found.' });
      return res.status(409).json({ success: false, message: 'Only pending orders can be verified.' });
    }
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_ORDER_VERIFIED',
      module: 'medication-orders',
      details: `Verified medication order ${order.orderNumber}`,
      req
    });
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/discontinue', requireAuth, requireRole(['prescriber', 'pharmacist', 'medication_admin']), validateOrderId, async (req, res, next) => {
  try {
    const order = await MedicationOrder.findOneAndUpdate(
      { _id: req.params.id, orderStatus: { $nin: closedOrderStatuses } },
      { $set: { orderStatus: 'Discontinued', verificationStatus: 'Verified' } },
      { new: true, runValidators: true }
    );
    if (!order) {
      const exists = await MedicationOrder.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ success: false, message: 'Order not found.' });
      return res.status(409).json({ success: false, message: 'This medication order is already closed.' });
    }
    await MedicationSchedule.updateMany(
      { orderId: order._id, status: { $in: ['Scheduled', 'Due'] } },
      { $set: { status: 'Discontinued' } }
    );
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'MEDICATION_ORDER_DISCONTINUED',
      module: 'medication-orders',
      details: `Discontinued medication order ${order.orderNumber}`,
      req
    });
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
