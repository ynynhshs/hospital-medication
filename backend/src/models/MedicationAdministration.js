const mongoose = require('mongoose');

const medicationAdministrationSchema = new mongoose.Schema({
  recordNumber: { type: String, required: true, unique: true, trim: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationOrder', required: true },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationSchedule', default: null },
  patientId: { type: String, required: true },
  admissionReference: { type: String, default: '' },
  medicationName: { type: String, required: true },
  prescribedDose: { type: String, default: '' },
  actualDose: { type: String, default: '' },
  doseUnit: { type: String, default: 'mg' },
  route: { type: String, default: 'Oral' },
  scheduledDateTime: { type: Date, default: null },
  actualAdministrationTime: { type: Date, default: null },
  status: { type: String, enum: ['Scheduled', 'Due', 'Administered', 'Delayed', 'Withheld', 'Refused', 'Omitted', 'Missed', 'Discontinued'], default: 'Scheduled' },
  administeringUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  witnessReference: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
  exceptionReason: { type: String, default: '' },
  patientResponse: { type: String, default: '' },
  dateCreated: { type: Date, default: Date.now }
}, {
  collection: 'medicationAdministrationRecords',
  versionKey: false,
  timestamps: true
});

const MedicationAdministration = mongoose.models.MedicationAdministration || mongoose.model('MedicationAdministration', medicationAdministrationSchema, 'medicationAdministrationRecords');
module.exports = MedicationAdministration;
