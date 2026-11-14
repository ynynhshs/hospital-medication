const crypto = require('node:crypto');
const express = require('express');
const z = require('zod');
const Patient = require('../../models/Patient');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationAdministration = require('../../models/MedicationAdministration');
const MedicationSchedule = require('../../models/MedicationSchedule');
const MedicationException = require('../../models/MedicationException');
const User = require('../../models/User');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { recordAudit } = require('../../lib/audit');

const router = express.Router();
const editableRoles = ['nurse', 'prescriber', 'pharmacist', 'medication_admin'];
const readRoles = [...editableRoles, 'medication_auditor'];
const sexValues = ['Male', 'Female'];
const civilStatusValues = ['Single', 'Married', 'Widowed', 'Separated'];
const bloodTypeValues = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const nullableText = z.string().trim().nullable();
const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(150),
  relationship: nullableText,
  contactNo: z.string().trim().min(1).max(40).optional(),
  phone: z.string().trim().min(1).max(40).optional()
}).strict().superRefine((contact, context) => {
  if (!contact.contactNo && !contact.phone) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactNo'],
      message: 'An emergency contact number is required.'
    });
  }
}).transform((contact) => ({
  name: contact.name,
  relationship: contact.relationship,
  contactNo: contact.contactNo || contact.phone
}));
const birthDateSchema = z.coerce.date().refine(
  (date) => date <= new Date(),
  'Birth date cannot be in the future.'
);

const patientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100),
  lastName: z.string().trim().min(1).max(100),
  birthDate: birthDateSchema,
  sex: z.enum(sexValues),
  civilStatus: z.enum(civilStatusValues),
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(120),
  contactNo: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  emergencyContact: emergencyContactSchema,
  medical: z.object({
    bloodType: z.enum(bloodTypeValues).nullable(),
    heightCm: z.number().positive().max(300).nullable(),
    weightKg: z.number().positive().max(1000).nullable(),
    allergies: nullableText,
    conditions: nullableText,
    medications: nullableText,
    surgeries: nullableText,
    smoker: z.boolean().nullable()
  }).strict(),
  insurance: z.object({
    provider: nullableText,
    memberNo: nullableText
  }).strict()
}).strict();

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  sex: z.enum(sexValues).optional(),
  civilStatus: z.enum(civilStatusValues).optional(),
  city: z.string().trim().max(120).optional(),
  bloodType: z.enum(bloodTypeValues).optional(),
  smoker: z.enum(['yes', 'no', 'not-recorded']).optional(),
  insuranceProvider: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['patientId', 'firstName', 'lastName', 'birthDate', 'sex', 'city']).default('lastName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializePatient(patient) {
  const result = patient.toObject ? patient.toObject() : { ...patient };
  result.medical = { ...(result.medical || {}) };
  result.medical.heightCm = result.medical.heightCm ?? result.medical.height ?? null;
  result.medical.weightKg = result.medical.weightKg ?? result.medical.weight ?? null;
  delete result.medical.height;
  delete result.medical.weight;
  if (result.emergencyContact) {
    result.emergencyContact.contactNo = result.emergencyContact.contactNo || result.emergencyContact.phone || '';
    delete result.emergencyContact.phone;
  }
  return result;
}

async function getPatientMedicationData(patientId) {
  const [patient, orders, administrations, schedules, exceptions] = await Promise.all([
    Patient.findOne({ patientId }),
    MedicationOrder.find({ patientId }).sort({ createdAt: -1 }).lean(),
    MedicationAdministration.find({ patientId })
      .sort({ actualAdministrationTime: -1 })
      .populate({ path: 'administeringUserId', model: User, select: 'username firstName lastName' })
      .lean(),
    MedicationSchedule.find({ patientId }).sort({ scheduledDateTime: 1 }).lean(),
    MedicationException.find({ patientId }).sort({ dateTime: -1 }).lean()
  ]);
  if (!patient) return null;
  return {
    patient: serializePatient(patient),
    orders,
    administrations,
    schedules,
    exceptions
  };
}

function flattenObject(value, prefix = '', result = {}) {
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue) && !(nestedValue instanceof Date)) {
      flattenObject(nestedValue, path, result);
    } else {
      result[path] = nestedValue;
    }
  }
  return result;
}

async function generatePatientId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const patientId = `P-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (!(await Patient.exists({ patientId }))) return patientId;
  }
  throw new Error('Unable to generate a unique patient ID.');
}

function handleDuplicateKey(error, res) {
  if (error && error.code === 11000) {
    res.status(409).json({
      success: false,
      message: error.keyPattern && error.keyPattern.email
        ? 'A patient with this email address already exists.'
        : 'A patient record with this identifier already exists.'
    });
    return true;
  }
  return false;
}

router.get('/', requireAuth, requireRole(readRoles), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const conditions = [];
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i');
      conditions.push({
        $or: [
          { patientId: regex },
          { firstName: regex },
          { middleName: regex },
          { lastName: regex },
          { contactNo: regex },
          { email: regex },
          { 'emergencyContact.contactNo': regex },
          { 'emergencyContact.phone': regex },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ['$firstName', ''] },
                        ' ',
                        { $ifNull: ['$middleName', ''] },
                        ' ',
                        { $ifNull: ['$lastName', ''] }
                      ]
                    }
                  }
                },
                regex: escapeRegex(query.search),
                options: 'i'
              }
            }
          }
        ]
      });
    }
    if (query.sex) conditions.push({ sex: query.sex });
    if (query.civilStatus) conditions.push({ civilStatus: query.civilStatus });
    if (query.city) conditions.push({ city: new RegExp(`^${escapeRegex(query.city)}$`, 'i') });
    if (query.bloodType) conditions.push({ 'medical.bloodType': query.bloodType });
    if (query.smoker === 'yes') conditions.push({ 'medical.smoker': true });
    if (query.smoker === 'no') conditions.push({ 'medical.smoker': false });
    if (query.smoker === 'not-recorded') {
      conditions.push({ $or: [{ 'medical.smoker': null }, { 'medical.smoker': { $exists: false } }] });
    }
    if (query.insuranceProvider) {
      conditions.push({ 'insurance.provider': new RegExp(escapeRegex(query.insuranceProvider), 'i') });
    }

    const filter = conditions.length ? { $and: conditions } : {};
    const sort = { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1, patientId: 1 };
    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Patient.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: patients.map(serializePatient),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole(editableRoles), async (req, res, next) => {
  try {
    const payload = patientSchema.parse(req.body);
    const duplicateEmail = await Patient.exists({
      email: new RegExp(`^${escapeRegex(payload.email)}$`, 'i')
    });
    if (duplicateEmail) {
      return res.status(409).json({ success: false, message: 'A patient with this email address already exists.' });
    }

    const patient = await Patient.create({
      ...payload,
      patientId: await generatePatientId()
    });
    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'PATIENT_CREATED',
      module: 'patients',
      details: 'Patient record created.',
      req
    });
    res.status(201).json({ success: true, data: serializePatient(patient) });
  } catch (error) {
    if (handleDuplicateKey(error, res)) return;
    next(error);
  }
});

router.get('/:patientId/medications', requireAuth, requireRole(readRoles), async (req, res, next) => {
  try {
    const data = await getPatientMedicationData(req.params.patientId);
    if (!data) return res.status(404).json({ success: false, message: 'Patient not found.' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/:patientId/medication-history', requireAuth, requireRole(readRoles), async (req, res, next) => {
  try {
    const data = await getPatientMedicationData(req.params.patientId);
    if (!data) return res.status(404).json({ success: false, message: 'Patient not found.' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/:patientId/administration-records', requireAuth, requireRole(readRoles), async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });
    const records = await MedicationAdministration.find({ patientId: req.params.patientId })
      .sort({ actualAdministrationTime: -1 })
      .populate({ path: 'administeringUserId', model: User, select: 'username firstName lastName' })
      .lean();
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

router.put('/:patientId', requireAuth, requireRole(editableRoles), async (req, res, next) => {
  try {
    const payload = patientSchema.parse(req.body);
    const duplicateEmail = await Patient.exists({
      patientId: { $ne: req.params.patientId },
      email: new RegExp(`^${escapeRegex(payload.email)}$`, 'i')
    });
    if (duplicateEmail) {
      return res.status(409).json({ success: false, message: 'A patient with this email address already exists.' });
    }

    const updatedPatient = await Patient.findOneAndUpdate(
      { patientId: req.params.patientId },
      { $set: flattenObject(payload) },
      { new: true, runValidators: true }
    );
    if (!updatedPatient) return res.status(404).json({ success: false, message: 'Patient not found.' });

    await recordAudit({
      username: req.session.user.username,
      role: req.session.user.role,
      action: 'PATIENT_UPDATED',
      module: 'patients',
      details: 'Patient record updated.',
      req
    });
    res.json({ success: true, data: serializePatient(updatedPatient) });
  } catch (error) {
    if (handleDuplicateKey(error, res)) return;
    next(error);
  }
});

router.get('/:patientId', requireAuth, requireRole(readRoles), async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    return res.status(200).json({ success: true, data: serializePatient(patient) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
