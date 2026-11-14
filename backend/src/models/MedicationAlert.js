const mongoose = require('mongoose');

const medicationAlertSchema = new mongoose.Schema({
  patientId: { type: String, default: '' },
  medicationOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationOrder', default: null },
  alertType: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  reviewed: { type: Boolean, default: false },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
  collection: 'medicationAlerts',
  versionKey: false
});

const MedicationAlert = mongoose.models.MedicationAlert || mongoose.model('MedicationAlert', medicationAlertSchema, 'medicationAlerts');
module.exports = MedicationAlert;
