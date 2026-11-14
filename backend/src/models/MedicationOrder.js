const mongoose = require('mongoose');

const medicationOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  patientId: { type: String, required: true },
  patientName: { type: String, default: '' },
  admissionReference: { type: String, default: '' },
  medicationCatalogId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicationCatalog', default: null },
  medicationName: { type: String, required: true },
  brandName: { type: String, default: '' },
  strength: { type: String, default: '' },
  dosageForm: { type: String, default: 'Tablet' },
  prescribedDose: { type: String, required: true },
  doseUnit: { type: String, default: 'mg' },
  route: { type: String, default: 'Oral' },
  frequency: { type: String, required: true },
  administrationSchedule: { type: String, default: 'Daily' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  prnIndicator: { type: Boolean, default: false },
  prnIndication: { type: String, default: '' },
  authorizedInstructions: { type: String, default: '' },
  prescriberUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  prescriberName: { type: String, default: '' },
  orderDate: { type: Date, default: Date.now },
  verificationStatus: { type: String, enum: ['Draft', 'Pending Verification', 'Verified', 'Returned for Clarification'], default: 'Draft' },
  orderStatus: { type: String, enum: ['Draft', 'Pending Verification', 'Verified', 'Active', 'On Hold', 'Discontinued', 'Completed', 'Cancelled', 'Returned for Clarification'], default: 'Draft' },
  clinicalNotes: { type: String, default: '' }
}, {
  collection: 'medicationOrders',
  versionKey: false,
  timestamps: true
});

const MedicationOrder = mongoose.models.MedicationOrder || mongoose.model('MedicationOrder', medicationOrderSchema, 'medicationOrders');
module.exports = MedicationOrder;
