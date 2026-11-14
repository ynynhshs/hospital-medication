const mongoose = require('mongoose');

const medicationExceptionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationOrder', default: null },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationSchedule', default: null },
  administrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationAdministration', default: null },
  patientId: { type: String, required: true },
  medicationName: { type: String, required: true },
  orderNumber: { type: String, default: '' },
  scheduledDose: { type: Date, default: null },
  exceptionType: { type: String, enum: ['Delayed', 'Missed', 'Refused', 'Withheld', 'Omitted'], required: true },
  reason: { type: String, required: true },
  dateTime: { type: Date, default: Date.now },
  documentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewStatus: { type: String, enum: ['Open', 'Reviewed'], default: 'Open' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  followUpNotes: { type: String, default: '' }
}, {
  collection: 'medicationExceptions',
  versionKey: false,
  timestamps: true
});

const MedicationException = mongoose.models.MedicationException || mongoose.model('MedicationException', medicationExceptionSchema, 'medicationExceptions');
module.exports = MedicationException;
