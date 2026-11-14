const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'patient-workflow-test-secret';
process.env.TZ = 'Asia/Manila';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB_NAME = 'medilink_patients_test';

const request = require('supertest');
const app = require('../backend/src/app');
const User = require('../backend/src/models/User');
const Patient = require('../backend/src/models/Patient');
const MedicationOrder = require('../backend/src/models/MedicationOrder');
const MedicationSchedule = require('../backend/src/models/MedicationSchedule');
const MedicationAdministration = require('../backend/src/models/MedicationAdministration');
const MedicationException = require('../backend/src/models/MedicationException');
const { hashPassword } = require('../backend/src/utils/password');
const { connectDatabase, stopDatabase } = require('../backend/src/config/database');

let adminAgent;
let auditorAgent;

function validPatient(overrides = {}) {
  return {
    firstName: 'Lina',
    middleName: 'Santos',
    lastName: 'Reyes',
    birthDate: '1987-04-12',
    sex: 'Female',
    civilStatus: 'Married',
    address: '12 Sample Street',
    city: 'Manila',
    contactNo: '09171234567',
    email: 'lina.reyes@example.test',
    emergencyContact: { name: 'Jose Reyes', relationship: 'Spouse', contactNo: '09179876543' },
    medical: {
      bloodType: null,
      heightCm: null,
      weightKg: null,
      allergies: null,
      conditions: null,
      medications: null,
      surgeries: null,
      smoker: null
    },
    insurance: { provider: null, memberNo: null },
    ...overrides
  };
}

test.before(async () => {
  await connectDatabase();
  await User.deleteMany({});
  await Patient.deleteMany({});
  await MedicationOrder.deleteMany({});
  await MedicationSchedule.deleteMany({});
  await MedicationAdministration.deleteMany({});
  await MedicationException.deleteMany({});

  const passwordHash = await hashPassword('SecureTest123!');
  await User.create({
    firstName: 'Local',
    lastName: 'Admin',
    employeeId: 'PATIENT-ADMIN-001',
    username: 'patient-admin',
    email: 'patient-admin@example.test',
    passwordHash,
    role: 'medication_admin',
    Status: 'Active'
  });
  await User.create({
    firstName: 'Read',
    lastName: 'Only',
    employeeId: 'PATIENT-AUDITOR-001',
    username: 'patient-auditor',
    email: 'patient-auditor@example.test',
    passwordHash,
    role: 'medication_auditor',
    Status: 'Active'
  });

  adminAgent = request.agent(app);
  auditorAgent = request.agent(app);
  const adminLogin = await adminAgent.post('/api/v1/auth/login').send({
    username: 'patient-admin',
    password: 'SecureTest123!'
  });
  const auditorLogin = await auditorAgent.post('/api/v1/auth/login').send({
    username: 'patient-auditor',
    password: 'SecureTest123!'
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(auditorLogin.status, 200);
});

test.after(async () => {
  await User.deleteMany({});
  await Patient.deleteMany({});
  await MedicationOrder.deleteMany({});
  await MedicationSchedule.deleteMany({});
  await MedicationAdministration.deleteMany({});
  await MedicationException.deleteMany({});
  await stopDatabase();
});

test('patient creation generates an ID and keeps unknown medical values null', async () => {
  const response = await adminAgent.post('/api/v1/patients').send(validPatient());
  assert.equal(response.status, 201);
  assert.match(response.body.data.patientId, /^P-[A-Z0-9]+-[A-F0-9]{6}$/);
  assert.equal(response.body.data.middleName, 'Santos');
  assert.equal(response.body.data.medical.heightCm, null);
  assert.equal(response.body.data.medical.smoker, null);
  assert.deepEqual(response.body.data.emergencyContact, {
    name: 'Jose Reyes',
    relationship: 'Spouse',
    contactNo: '09179876543'
  });
});

test('patient API reads legacy emergency contact phone and writes the shared contactNo field', async () => {
  const patient = await Patient.create({
    ...validPatient({ email: 'legacy.contact@example.test' }),
    patientId: 'P-LEGACY-CONTACT-001',
    emergencyContact: {
      name: 'Legacy Contact',
      relationship: 'Relative',
      phone: '09170000000'
    }
  });

  const response = await adminAgent.get(`/api/v1/patients/${patient.patientId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.emergencyContact.contactNo, '09170000000');
  assert.equal(Object.hasOwn(response.body.data.emergencyContact, 'phone'), false);

  const stored = await Patient.findOne({ patientId: patient.patientId }).lean();
  assert.equal(stored.emergencyContact.phone, '09170000000');
});

test('patient creation validates required and typed dictionary fields', async () => {
  const payload = validPatient({
    email: 'not-an-email',
    birthDate: '2999-01-01',
    medical: { ...validPatient().medical, heightCm: -2 }
  });
  const response = await adminAgent.post('/api/v1/patients').send(payload);
  assert.equal(response.status, 400);
  assert.ok(response.body.errors.some((error) => error.path.includes('email')));
  assert.ok(response.body.errors.some((error) => error.path.includes('birthDate')));
  assert.ok(response.body.errors.some((error) => error.path.includes('heightCm')));
});

test('duplicate patient email is rejected regardless of letter case', async () => {
  const response = await adminAgent.post('/api/v1/patients').send(validPatient({
    firstName: 'Another',
    email: 'LINA.REYES@EXAMPLE.TEST'
  }));
  assert.equal(response.status, 409);
});

test('patient search covers full and middle names with paginated filters and sorting', async () => {
  await adminAgent.post('/api/v1/patients').send(validPatient({
    firstName: 'Marco',
    middleName: 'Luis',
    lastName: 'Garcia',
    email: 'marco.garcia@example.test',
    city: 'Cebu',
    sex: 'Male',
    civilStatus: 'Single'
  }));

  const fullName = await adminAgent.get('/api/v1/patients').query({ search: 'Marco Luis Garcia', page: 1, limit: 1 });
  assert.equal(fullName.status, 200);
  assert.equal(fullName.body.data.length, 1);
  assert.equal(fullName.body.data[0].lastName, 'Garcia');
  assert.equal(fullName.body.pagination.total, 1);

  const filtered = await adminAgent.get('/api/v1/patients').query({
    search: 'Luis',
    sex: 'Male',
    city: 'cebu',
    civilStatus: 'Single'
  });
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.data.length, 1);
  assert.equal(filtered.body.data[0].middleName, 'Luis');
});

test('patient details expose every dictionary group and preserve legacy measurements', async () => {
  const patient = await Patient.create({
    ...validPatient({ email: 'legacy.patient@example.test' }),
    patientId: 'P-LEGACY-001',
    medical: {
      bloodType: 'O+',
      height: 165,
      weight: 62,
      allergies: null,
      conditions: null,
      medications: null,
      surgeries: null,
      smoker: null
    }
  });
  const response = await adminAgent.get(`/api/v1/patients/${patient.patientId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.medical.heightCm, 165);
  assert.equal(response.body.data.medical.weightKg, 62);
  assert.equal(Object.hasOwn(response.body.data.medical, 'height'), false);
  assert.ok(response.body.data.insurance);
  assert.ok(response.body.data.emergencyContact);
});

test('patient edits update canonical dictionary paths without discarding legacy measurement storage', async () => {
  const patient = await Patient.create({
    ...validPatient({ email: 'update.patient@example.test' }),
    patientId: 'P-UPDATE-001',
    medical: {
      height: 155,
      weight: 51,
      smoker: null
    }
  });
  const response = await adminAgent.put(`/api/v1/patients/${patient.patientId}`).send(validPatient({
    email: 'update.patient@example.test',
    medical: {
      bloodType: 'A+',
      heightCm: 159,
      weightKg: 53,
      allergies: 'Latex',
      conditions: null,
      medications: null,
      surgeries: null,
      smoker: false
    }
  }));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.medical.heightCm, 159);
  assert.equal(response.body.data.medical.weightKg, 53);
  assert.equal(response.body.data.medical.smoker, false);

  const stored = await Patient.findOne({ patientId: patient.patientId }).lean();
  assert.equal(stored.medical.height, 155);
  assert.equal(stored.medical.heightCm, 159);
});

test('patient APIs enforce edit permissions and expose read-only medication history', async () => {
  const patient = await Patient.create({
    ...validPatient({ email: 'auditor.patient@example.test' }),
    patientId: 'P-AUDIT-001'
  });
  const read = await auditorAgent.get(`/api/v1/patients/${patient.patientId}/medication-history`);
  assert.equal(read.status, 200);
  assert.equal(read.body.data.patient.patientId, patient.patientId);

  const write = await auditorAgent.put(`/api/v1/patients/${patient.patientId}`).send(validPatient({
    email: 'auditor.patient@example.test'
  }));
  assert.equal(write.status, 403);
});
