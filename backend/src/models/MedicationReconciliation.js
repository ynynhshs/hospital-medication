const mongoose = require('mongoose');

const medicationReconciliationSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  medicationName: { type: String, required: true },
  existingMedicationInfo: { type: String, default: '' },
  reviewOutcome: { type: String, default: '' },
  discrepancies: { type: String, default: '' },
  responsibleUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
  dateTime: { type: Date, default: Date.now }
}, {
  collection: 'medicationReconciliation',
  versionKey: false,
  timestamps: true
});

const MedicationReconciliation = mongoose.models.MedicationReconciliation || mongoose.model('MedicationReconciliation', medicationReconciliationSchema, 'medicationReconciliation');
module.exports = MedicationReconciliation;
