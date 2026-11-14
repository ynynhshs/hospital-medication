const mongoose = require('mongoose');

const medicationScheduleSchema = new mongoose.Schema({
  scheduleId: { type: String, required: true, unique: true, trim: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationOrder', required: true },
  patientId: { type: String, required: true },
  patientName: { type: String, default: '' },
  medicationName: { type: String, required: true },
  prescribedDose: { type: String, required: true },
  route: { type: String, default: 'Oral' },
  scheduledDateTime: { type: Date, required: true },
  assignment: { type: String, default: '' },
  status: { type: String, default: 'Scheduled', enum: ['Scheduled', 'Due', 'Administered', 'Delayed', 'Withheld', 'Refused', 'Omitted', 'Missed', 'Discontinued'] },
  relatedAdministrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationAdministration', default: null }
}, {
  collection: 'medicationSchedules',
  versionKey: false,
  timestamps: true
});

medicationScheduleSchema.index({ status: 1, scheduledDateTime: 1 });

const MedicationSchedule = mongoose.models.MedicationSchedule || mongoose.model('MedicationSchedule', medicationScheduleSchema, 'medicationSchedules');
module.exports = MedicationSchedule;
