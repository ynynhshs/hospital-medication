const mongoose = require('mongoose');

const medicationCatalogSchema = new mongoose.Schema({
  medicationCode: { type: String, required: true, unique: true, trim: true },
  genericName: { type: String, required: true, trim: true },
  brandName: { type: String, default: '' },
  strength: { type: String, default: '' },
  dosageForm: { type: String, default: 'Tablet' },
  route: { type: String, default: 'Oral' },
  unit: { type: String, default: 'mg' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  notes: { type: String, default: '' }
}, {
  collection: 'medicationCatalog',
  versionKey: false,
  timestamps: true
});

const MedicationCatalog = mongoose.models.MedicationCatalog || mongoose.model('MedicationCatalog', medicationCatalogSchema, 'medicationCatalog');
module.exports = MedicationCatalog;
