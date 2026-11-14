const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true },
  middleName: { type: String, default: '' },
  lastName: { type: String, required: true },
  birthDate: { type: Date, required: true },
  sex: { type: String, required: true },
  civilStatus: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  contactNo: { type: String, default: '' },
  email: { type: String, default: '' },
  emergencyContact: {
    name: { type: String, default: '' },
    relationship: { type: String, default: '' },
    contactNo: { type: String, default: '' },
    phone: { type: String }
  },
  medical: {
    bloodType: { type: String, default: null },
    heightCm: { type: Number, default: null },
    weightKg: { type: Number, default: null },
    height: { type: Number, default: null },
    weight: { type: Number, default: null },
    allergies: { type: String, default: null },
    conditions: { type: String, default: null },
    medications: { type: String, default: null },
    surgeries: { type: String, default: null },
    smoker: { type: Boolean, default: null }
  },
  insurance: {
    provider: { type: String, default: null },
    memberNo: { type: String, default: null }
  }
}, {
  collection: 'patients',
  timestamps: true
});

patientSchema.virtual('fullName').get(function () {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

patientSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);

const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema, 'patients');
module.exports = Patient;
