const express = require('express');
const z = require('zod');
const MedicationCatalog = require('../../models/MedicationCatalog');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();
const catalogSchema = z.object({
  medicationCode: z.string().min(1),
  genericName: z.string().min(1),
  brandName: z.string().optional(),
  strength: z.string().optional(),
  dosageForm: z.string().optional(),
  route: z.string().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().optional()
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q) : '';
    const filter = q ? { $or: [{ genericName: { $regex: q, $options: 'i' } }, { brandName: { $regex: q, $options: 'i' } }] } : {};
    const catalog = await MedicationCatalog.find(filter).sort({ genericName: 1 });
    res.json({ success: true, data: catalog });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole(['medication_admin', 'pharmacist', 'prescriber']), async (req, res, next) => {
  try {
    const payload = catalogSchema.parse(req.body);
    const exists = await MedicationCatalog.findOne({ medicationCode: payload.medicationCode });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Medication code already exists.' });
    }
    const item = await MedicationCatalog.create(payload);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, requireRole(['medication_admin', 'pharmacist']), async (req, res, next) => {
  try {
    const payload = catalogSchema.partial().parse(req.body);
    const item = await MedicationCatalog.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Medication not found.' });
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
