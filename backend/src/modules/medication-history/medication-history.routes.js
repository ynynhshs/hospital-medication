const express = require('express');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationAdministration = require('../../models/MedicationAdministration');
const MedicationException = require('../../models/MedicationException');
const MedicationReconciliation = require('../../models/MedicationReconciliation');
const Patient = require('../../models/Patient');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId.trim() : '';
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'A patient ID is required.' });
    }
    if (!(await Patient.exists({ patientId }))) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const filter = { patientId };
    const [orders, administrations, exceptions, reconciliations] = await Promise.all([
      MedicationOrder.find(filter).sort({ createdAt: -1 }).lean(),
      MedicationAdministration.find(filter).sort({ createdAt: -1 }).lean(),
      MedicationException.find(filter).sort({ dateTime: -1 }).lean(),
      MedicationReconciliation.find(filter).sort({ dateTime: -1 }).lean()
    ]);

    res.json({ success: true, data: { orders, administrations, exceptions, reconciliations } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
