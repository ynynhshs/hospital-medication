const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.TZ = 'Asia/Manila';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB_NAME = 'medilink_medication_test';
const request = require('supertest');
const app = require('../backend/src/app');
const User = require('../backend/src/models/User');
const Patient = require('../backend/src/models/Patient');
const MedicationCatalog = require('../backend/src/models/MedicationCatalog');
const MedicationOrder = require('../backend/src/models/MedicationOrder');
const MedicationSchedule = require('../backend/src/models/MedicationSchedule');
const MedicationAdministration = require('../backend/src/models/MedicationAdministration');
const MedicationException = require('../backend/src/models/MedicationException');
const MedicationAlert = require('../backend/src/models/MedicationAlert');
const MedicationReconciliation = require('../backend/src/models/MedicationReconciliation');
const Setting = require('../backend/src/models/Setting');
const AuditLog = require('../backend/src/models/AuditLog');
const { hashPassword } = require('../backend/src/utils/password');
const { connectDatabase, stopDatabase } = require('../backend/src/config/database');

let agent;
let orderId;
let scheduleId;
let secondScheduleId;

test.before(async () => {
  await connectDatabase();
  await User.deleteMany({});
  await Patient.deleteMany({});
  await MedicationCatalog.deleteMany({});
  await MedicationOrder.deleteMany({});
  await MedicationSchedule.deleteMany({});
  await MedicationAdministration.deleteMany({});
  await MedicationException.deleteMany({});
  await MedicationAlert.deleteMany({});
  await MedicationReconciliation.deleteMany({});
  await Setting.deleteMany({});
  await AuditLog.deleteMany({});

  const hashed = await hashPassword('Secret123!');
  await User.create({
    firstName: 'Nurse',
    lastName: 'Test',
    employeeId: 'EMP-002',
    username: 'nurse',
    email: 'nurse@test.com',
    passwordHash: hashed,
    role: 'nurse',
    Status: 'Active'
  });
  await User.create({
    firstName: 'Admin',
    lastName: 'Test',
    employeeId: 'EMP-003',
    username: 'admin',
    email: 'admin@test.com',
    passwordHash: hashed,
    role: 'medication_admin',
    Status: 'Active'
  });

  await Patient.create({
    patientId: 'P-1001',
    firstName: 'Maria',
    lastName: 'Dela Cruz',
    birthDate: new Date('1990-01-15'),
    sex: 'Female',
    civilStatus: 'Single',
    address: 'Manila',
    city: 'Manila',
    email: 'maria@test.com'
  });

  agent = request.agent(app);
});

test.after(async () => {
  await User.deleteMany({});
  await Patient.deleteMany({});
  await MedicationCatalog.deleteMany({});
  await MedicationOrder.deleteMany({});
  await MedicationSchedule.deleteMany({});
  await MedicationAdministration.deleteMany({});
  await MedicationException.deleteMany({});
  await MedicationAlert.deleteMany({});
  await MedicationReconciliation.deleteMany({});
  await Setting.deleteMany({});
  await AuditLog.deleteMany({});
  await stopDatabase();
  process.exit(0);
});

test('valid login works', async () => {
  const loginResponse = await agent
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'Secret123!' });

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.success, true);
  assert.equal(loginResponse.body.data.user.username, 'admin');
  assert.ok(loginResponse.headers['set-cookie']);
});

test('shared lab administrators receive medication administrator access without role rewrites', async () => {
  const passwordHash = await hashPassword('SharedAdmin123!');
  const sharedAdmin = await User.create({
    firstName: 'Shared',
    lastName: 'Administrator',
    employeeId: 'EMP-SHARED-001',
    username: 'shared-lab-admin',
    email: 'shared-admin@test.com',
    passwordHash,
    role: 'lab_admin',
    status: 'Active'
  });
  const sharedAgent = request.agent(app);
  const login = await sharedAgent.post('/api/v1/auth/login').send({
    username: sharedAdmin.username,
    password: 'SharedAdmin123!'
  });

  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'medication_admin');
  assert.equal((await sharedAgent.get('/api/v1/auth/me')).body.data.user.role, 'medication_admin');
  assert.equal((await User.findById(sharedAdmin._id)).role, 'lab_admin');
});

test('invalid login fails', async () => {
  const loginResponse = await agent
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'wrong' });

  assert.equal(loginResponse.status, 401);
  assert.equal(loginResponse.body.success, false);
});

test('validation failures return 400 across authentication, query, and write routes', async () => {
  const invalidLogin = await agent.post('/api/v1/auth/login').send({ username: '' });
  assert.equal(invalidLogin.status, 400);
  assert.equal(invalidLogin.body.message, 'Invalid request.');
  assert.ok(invalidLogin.body.errors.length > 0);

  const invalidPatientQuery = await agent.get('/api/v1/patients?limit=not-a-number');
  assert.equal(invalidPatientQuery.status, 400);

  const invalidCatalog = await agent.post('/api/v1/medication-catalog').send({});
  assert.equal(invalidCatalog.status, 400);

  const invalidOrder = await agent.post('/api/v1/medication-orders').send({});
  assert.equal(invalidOrder.status, 400);
});

test('orders reject client-controlled verification status and reversed dates', async () => {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() - 60 * 60 * 1000);
  const reversedDates = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Test medication',
    prescribedDose: '1',
    frequency: 'Daily',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  assert.equal(reversedDates.status, 400);

  const selfVerified = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Test medication',
    prescribedDose: '1',
    frequency: 'Daily',
    startDate: startDate.toISOString(),
    orderStatus: 'Active',
    verificationStatus: 'Verified'
  });
  assert.equal(selfVerified.status, 400);

  const invalidOrderId = await agent.post('/api/v1/medication-orders/not-an-id/verify');
  assert.equal(invalidOrderId.status, 400);
});

test('patient lookup and medication catalog create works', async () => {
  const catalogPage = await agent.get('/pages/medication-catalog.html');
  assert.equal(catalogPage.status, 200);
  assert.match(catalogPage.text, /\/js\/medication-catalog\.js/);
  assert.doesNotMatch(catalogPage.text, /<script>\s/);

  const catalogScript = await agent.get('/js/medication-catalog.js');
  assert.equal(catalogScript.status, 200);
  assert.match(catalogScript.text, /apiFetch/);

  const patientLookup = await agent.get('/api/v1/patients').query({ search: 'P-1001' });
  assert.equal(patientLookup.status, 200);
  assert.equal(patientLookup.body.success, true);
  assert.equal(patientLookup.body.data[0].patientId, 'P-1001');

  const regexSearch = await agent.get('/api/v1/patients').query({ search: '.*' });
  assert.equal(regexSearch.status, 200);
  assert.equal(regexSearch.body.data.length, 0);

  const excessiveLimit = await agent.get('/api/v1/patients').query({ limit: 1000 });
  assert.equal(excessiveLimit.status, 400);

  const catalogResponse = await agent.post('/api/v1/medication-catalog').send({
    medicationCode: 'PAR-001',
    genericName: 'Paracetamol',
    strength: '500mg',
    dosageForm: 'Tablet',
    route: 'Oral',
    unit: 'mg'
  });

  assert.equal(catalogResponse.status, 201);
  assert.equal(catalogResponse.body.success, true);
  assert.equal(catalogResponse.body.data.medicationCode, 'PAR-001');
});

test('medication order creation works for valid patient', async () => {
  const orderPage = await agent.get('/pages/medication-orders.html');
  assert.equal(orderPage.status, 200);
  assert.match(orderPage.text, /id="endDate"/);
  const orderScript = await agent.get('/js/medication-orders.js');
  assert.equal(orderScript.status, 200);
  assert.match(orderScript.text, /discontinue/);

  const orderResponse = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    doseUnit: 'mg',
    route: 'Oral',
    frequency: 'Every 8 hours',
    startDate: new Date().toISOString()
  });

  assert.equal(orderResponse.status, 201);
  assert.equal(orderResponse.body.success, true);
  assert.equal(orderResponse.body.data.patientId, 'P-1001');
  assert.equal(orderResponse.body.data.orderStatus, 'Pending Verification');
  orderId = orderResponse.body.data._id;

  const alerts = await agent.get('/api/v1/medication-alerts');
  assert.equal(alerts.status, 200);
  assert.equal(alerts.body.data.length, 1);
  assert.equal(alerts.body.data[0].medicationOrderId, orderId);
  assert.equal(alerts.body.data[0].generated, true);
  assert.equal(await MedicationAlert.countDocuments(), 0);

  const repeatedAlerts = await agent.get('/api/v1/medication-alerts');
  assert.equal(repeatedAlerts.body.data.length, 1);
  assert.equal(await MedicationAlert.countDocuments(), 0);
});

test('verified orders generate an idempotent interval schedule', async () => {
  const pendingSchedules = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(pendingSchedules.status, 201);
  assert.equal(pendingSchedules.body.data.length, 0);

  const prematureAdministration = await agent.post('/api/v1/medication-administration/record').send({
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    actualDose: '500',
    status: 'Administered'
  });
  assert.equal(prematureAdministration.status, 409);

  const verification = await agent.post(`/api/v1/medication-orders/${orderId}/verify`);
  assert.equal(verification.status, 200);
  assert.equal(verification.body.data.verificationStatus, 'Verified');
  assert.equal(verification.body.data.orderStatus, 'Active');
  const repeatedVerification = await agent.post(`/api/v1/medication-orders/${orderId}/verify`);
  assert.equal(repeatedVerification.status, 409);
  const alertsAfterVerification = await agent.get('/api/v1/medication-alerts');
  assert.equal(alertsAfterVerification.body.data.length, 0);

  const generated = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(generated.status, 201);
  assert.ok(generated.body.data.length >= 2);
  assert.equal(generated.body.data[0].status, 'Due');
  assert.equal(
    new Date(generated.body.data[1].scheduledDateTime).getTime() -
      new Date(generated.body.data[0].scheduledDateTime).getTime(),
    8 * 60 * 60 * 1000
  );
  const dashboard = await agent.get('/api/v1/dashboard/summary');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.activeOrders, 1);
  assert.ok(dashboard.body.data.dueToday >= 1);
  assert.ok(dashboard.body.data.dueNow >= 1);
  assert.equal(dashboard.body.data.timeZone, 'Asia/Manila');
  scheduleId = generated.body.data[0]._id;
  secondScheduleId = generated.body.data[1]._id;

  const repeatedGeneration = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(repeatedGeneration.status, 201);
  assert.equal(repeatedGeneration.body.data.length, 0);
});

test('administrations must match the order and record a scheduled dose only once', async () => {
  const baseRecord = {
    orderId,
    scheduleId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    actualDose: '500',
    doseUnit: 'mg',
    route: 'Oral',
    status: 'Administered'
  };

  const mismatch = await agent.post('/api/v1/medication-administration/record').send({
    ...baseRecord,
    patientId: 'P-9999'
  });
  assert.equal(mismatch.status, 409);

  const missingActualDose = await agent.post('/api/v1/medication-administration/record').send({
    ...baseRecord,
    actualDose: ''
  });
  assert.equal(missingActualDose.status, 400);

  const recorded = await agent.post('/api/v1/medication-administration/record').send(baseRecord);
  assert.equal(recorded.status, 201);
  assert.equal(recorded.body.data.status, 'Administered');
  assert.ok(recorded.body.data.actualAdministrationTime);
  const dashboard = await agent.get('/api/v1/dashboard/summary');
  assert.equal(dashboard.body.data.successfulToday, 1);

  const duplicate = await agent.post('/api/v1/medication-administration/record').send(baseRecord);
  assert.equal(duplicate.status, 409);

  const schedule = await MedicationSchedule.findById(scheduleId);
  assert.equal(schedule.status, 'Administered');
  assert.equal(schedule.relatedAdministrationId.toString(), recorded.body.data._id);
});

test('non-administered doses require a documented reason', async () => {
  const missingReason = await agent.post('/api/v1/medication-administration/record').send({
    orderId,
    scheduleId: secondScheduleId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    status: 'Withheld'
  });
  assert.equal(missingReason.status, 400);

  const recorded = await agent.post('/api/v1/medication-administration/record').send({
    orderId,
    scheduleId: secondScheduleId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    status: 'Withheld',
    exceptionReason: 'Patient temporarily unable to take oral medication.'
  });
  assert.equal(recorded.status, 201);
  assert.equal(recorded.body.data.status, 'Withheld');
  assert.equal(recorded.body.data.actualAdministrationTime, null);
  assert.equal((await MedicationSchedule.findById(secondScheduleId)).status, 'Withheld');

  const exception = await MedicationException.findOne({ administrationId: recorded.body.data._id });
  assert.ok(exception);
  assert.equal(exception.exceptionType, 'Withheld');
  assert.equal(exception.reviewStatus, 'Open');
  assert.equal(exception.orderId.toString(), orderId);

  const review = await agent.post(`/api/v1/medication-exceptions/${exception._id}/review`).send({
    followUpNotes: 'Reviewed by pharmacist.'
  });
  assert.equal(review.status, 200);
  assert.equal(review.body.data.reviewStatus, 'Reviewed');
  assert.ok(review.body.data.reviewedAt);

  const repeatedReview = await agent.post(`/api/v1/medication-exceptions/${exception._id}/review`).send({});
  assert.equal(repeatedReview.status, 409);
});

test('PRN orders are not scheduled but can be administered without a schedule', async () => {
  const missingIndication = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    doseUnit: 'mg',
    route: 'Oral',
    frequency: 'PRN',
    prnIndicator: true,
    startDate: new Date().toISOString()
  });
  assert.equal(missingIndication.status, 400);

  const created = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    doseUnit: 'mg',
    route: 'Oral',
    frequency: 'PRN',
    prnIndicator: true,
    prnIndication: 'As needed',
    startDate: new Date().toISOString()
  });
  assert.equal(created.status, 201);

  const orderId = created.body.data._id;
  const verified = await agent.post(`/api/v1/medication-orders/${orderId}/verify`);
  assert.equal(verified.status, 200);

  const generated = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(generated.status, 201);
  assert.equal(await MedicationSchedule.countDocuments({ orderId }), 0);

  const administered = await agent.post('/api/v1/medication-administration/record').send({
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    actualDose: '500',
    doseUnit: 'mg',
    route: 'Oral',
    status: 'Administered'
  });
  assert.equal(administered.status, 201);
  assert.equal(administered.body.data.scheduleId, null);
});

test('schedule generation stops at the verified order end date', async () => {
  const startDate = new Date(Date.now() + 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const created = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Short course medication',
    prescribedDose: '1',
    doseUnit: 'tablet',
    route: 'Oral',
    frequency: 'Every 8 hours',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  assert.equal(created.status, 201);

  const verified = await agent.post(`/api/v1/medication-orders/${created.body.data._id}/verify`);
  assert.equal(verified.status, 200);

  const generated = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(generated.status, 201);
  const orderSchedules = await MedicationSchedule.find({ orderId: created.body.data._id }).lean();
  assert.equal(orderSchedules.length, 1);
  assert.ok(new Date(orderSchedules[0].scheduledDateTime) <= endDate);
});

test('discontinuing an order closes open schedules and prevents administration', async () => {
  const startDate = new Date(Date.now() + 60 * 1000);
  const created = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Discontinued test medication',
    prescribedDose: '1',
    doseUnit: 'tablet',
    route: 'Oral',
    frequency: 'Every 8 hours',
    startDate: startDate.toISOString()
  });
  assert.equal(created.status, 201);

  const verified = await agent.post(`/api/v1/medication-orders/${created.body.data._id}/verify`);
  assert.equal(verified.status, 200);
  const generated = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(generated.status, 201);

  const stopped = await agent.post(`/api/v1/medication-orders/${created.body.data._id}/discontinue`);
  assert.equal(stopped.status, 200);
  const schedules = await MedicationSchedule.find({ orderId: created.body.data._id }).lean();
  assert.ok(schedules.length > 0);
  assert.ok(schedules.every((schedule) => schedule.status === 'Discontinued'));

  const administration = await agent.post('/api/v1/medication-administration/record').send({
    orderId: created.body.data._id,
    scheduleId: schedules[0]._id,
    patientId: 'P-1001',
    medicationName: 'Discontinued test medication',
    actualDose: '1',
    status: 'Administered'
  });
  assert.equal(administration.status, 409);

  const repeatDiscontinue = await agent.post(`/api/v1/medication-orders/${created.body.data._id}/discontinue`);
  assert.equal(repeatDiscontinue.status, 409);
  assert.ok(await AuditLog.findOne({ action: 'MEDICATION_ORDER_DISCONTINUED' }));
});

test('unsupported fixed-frequency orders fail schedule generation explicitly', async () => {
  const created = await agent.post('/api/v1/medication-orders').send({
    patientId: 'P-1001',
    medicationName: 'Test medication',
    prescribedDose: '1',
    doseUnit: 'tablet',
    route: 'Oral',
    frequency: 'BID',
    startDate: new Date().toISOString()
  });
  assert.equal(created.status, 201);

  const orderId = created.body.data._id;
  const verified = await agent.post(`/api/v1/medication-orders/${orderId}/verify`);
  assert.equal(verified.status, 200);

  const generated = await agent.post('/api/v1/medication-schedules/generate');
  assert.equal(generated.status, 422);
  assert.equal(generated.body.success, false);
  assert.equal(await MedicationSchedule.countDocuments({ orderId }), 0);
});

test('new exceptions stay open until an authorized review', async () => {
  const created = await agent.post('/api/v1/medication-exceptions').send({
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    exceptionType: 'Refused',
    reason: 'Patient declined the dose.',
    reviewStatus: 'Reviewed'
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.reviewStatus, 'Open');

  const openExceptions = await agent.get('/api/v1/medication-exceptions?reviewStatus=Open');
  assert.equal(openExceptions.status, 200);
  assert.ok(openExceptions.body.data.some((exception) => exception._id === created.body.data._id));

  const invalidFilter = await agent.get('/api/v1/medication-exceptions?reviewStatus=All');
  assert.equal(invalidFilter.status, 400);
});

test('medication reconciliation requires a known patient and records discrepancies', async () => {
  const missingPatient = await agent.post('/api/v1/medication-reconciliation').send({
    patientId: 'P-MISSING',
    medicationName: 'Home medication',
    existingMedicationInfo: 'Patient reports taking one tablet daily.',
    reviewOutcome: 'Reconciled'
  });
  assert.equal(missingPatient.status, 404);

  const missingDiscrepancy = await agent.post('/api/v1/medication-reconciliation').send({
    patientId: 'P-1001',
    medicationName: 'Home medication',
    existingMedicationInfo: 'Patient reports taking one tablet daily.',
    reviewOutcome: 'Discrepancy Identified'
  });
  assert.equal(missingDiscrepancy.status, 400);

  const created = await agent.post('/api/v1/medication-reconciliation').send({
    patientId: 'P-1001',
    medicationName: 'Home medication',
    existingMedicationInfo: 'Patient reports taking one tablet daily.',
    reviewOutcome: 'Discrepancy Identified',
    discrepancies: 'Patient-reported frequency differs from the active order.',
    notes: 'Referred to pharmacist for review.'
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.reviewOutcome, 'Discrepancy Identified');
  assert.ok(created.body.data.responsibleUserId);

  const history = await agent.get('/api/v1/medication-reconciliation?patientId=P-1001');
  assert.equal(history.status, 200);
  assert.ok(history.body.data.some((record) => record._id === created.body.data._id));
});

test('medication history is patient-scoped and combines all medication records', async () => {
  const missingPatientId = await agent.get('/api/v1/medication-history');
  assert.equal(missingPatientId.status, 400);

  const unknownPatient = await agent.get('/api/v1/medication-history?patientId=P-MISSING');
  assert.equal(unknownPatient.status, 404);

  const history = await agent.get('/api/v1/medication-history?patientId=P-1001');
  assert.equal(history.status, 200);
  assert.equal(history.body.data.orders.length, 5);
  assert.equal(history.body.data.administrations.length, 3);
  assert.equal(history.body.data.exceptions.length, 2);
  assert.equal(history.body.data.reconciliations.length, 1);
});

test('medication history page and external script are served', async () => {
  const page = await agent.get('/pages/medication-history.html');
  assert.equal(page.status, 200);
  assert.match(page.text, /\/js\/medication-history\.js/);

  const script = await agent.get('/js/medication-history.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /apiFetch/);
});

test('medication alerts page and external script are served', async () => {
  const page = await agent.get('/pages/medication-alerts.html');
  assert.equal(page.status, 200);
  assert.match(page.text, /\/js\/medication-alerts\.js/);

  const script = await agent.get('/js/medication-alerts.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /apiFetch/);
});

test('facility settings page and external script are served', async () => {
  const page = await agent.get('/pages/settings.html');
  assert.equal(page.status, 200);
  assert.match(page.text, /\/js\/settings\.js/);

  const script = await agent.get('/js/settings.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /apiFetch/);
});

test('settings reject invalid updates and save valid facility values', async () => {
  const invalidThreshold = await agent.post('/api/v1/settings').send({ delayWarningThreshold: -1 });
  assert.equal(invalidThreshold.status, 400);
  const fractionalThreshold = await agent.post('/api/v1/settings').send({ delayWarningThreshold: 30.5 });
  assert.equal(fractionalThreshold.status, 400);
  const excessiveReminderLead = await agent.post('/api/v1/settings').send({ doseReminderLeadMinutes: 1441 });
  assert.equal(excessiveReminderLead.status, 400);

  const invalidTimezone = await agent.post('/api/v1/settings').send({ timezone: 'Not/A_Timezone' });
  assert.equal(invalidTimezone.status, 400);

  const emptyPayload = await agent.post('/api/v1/settings').send({});
  assert.equal(emptyPayload.status, 400);

  const saved = await agent.post('/api/v1/settings').send({
    hospitalName: 'MediLink Hospital',
    timezone: 'Asia/Manila',
    doseReminderLeadMinutes: 15,
    delayWarningThreshold: 30,
    missedDoseReviewThreshold: 120
  });
  assert.equal(saved.status, 200);

  const settings = await agent.get('/api/v1/settings');
  assert.equal(settings.status, 200);
  assert.equal(settings.body.data.hospitalName, 'MediLink Hospital');
  assert.equal(settings.body.data.timezone, 'Asia/Manila');
  assert.equal(settings.body.data.doseReminderLeadMinutes, 15);
  assert.equal(settings.body.data.delayWarningThreshold, 30);
  assert.equal(settings.body.data.missedDoseReviewThreshold, 120);
  assert.ok(await AuditLog.findOne({ action: 'SETTINGS_UPDATE', module: 'settings' }));
});

test('scheduled-dose alerts use configured thresholds without changing dose records', async () => {
  const now = Date.now();
  const delayedSchedule = await MedicationSchedule.create({
    scheduleId: `SCH-ALERT-DELAY-${now}`,
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    scheduledDateTime: new Date(now - 45 * 60 * 1000),
    status: 'Due'
  });
  const reviewSchedule = await MedicationSchedule.create({
    scheduleId: `SCH-ALERT-REVIEW-${now}`,
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    scheduledDateTime: new Date(now - 130 * 60 * 1000),
    status: 'Due'
  });
  const dueSchedule = await MedicationSchedule.create({
    scheduleId: `SCH-ALERT-DUE-${now}`,
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    scheduledDateTime: new Date(now - 60 * 1000),
    status: 'Due'
  });
  const upcomingSchedule = await MedicationSchedule.create({
    scheduleId: `SCH-ALERT-UPCOMING-${now}`,
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    scheduledDateTime: new Date(now + 10 * 60 * 1000),
    status: 'Scheduled'
  });
  const administeredSchedule = await MedicationSchedule.create({
    scheduleId: `SCH-ALERT-ADMINISTERED-${now}`,
    orderId,
    patientId: 'P-1001',
    medicationName: 'Paracetamol',
    prescribedDose: '500',
    scheduledDateTime: new Date(now - 60 * 1000),
    status: 'Administered'
  });
  const storedAlertsBefore = await MedicationAlert.countDocuments();

  const alerts = await agent.get('/api/v1/medication-alerts');
  assert.equal(alerts.status, 200);
  assert.equal(
    alerts.body.data.find((alert) => alert.scheduleId === delayedSchedule._id.toString()).alertType,
    'Dose delay warning'
  );
  assert.equal(
    alerts.body.data.find((alert) => alert.scheduleId === reviewSchedule._id.toString()).alertType,
    'Unrecorded dose requires review'
  );
  assert.equal(
    alerts.body.data.find((alert) => alert.scheduleId === dueSchedule._id.toString()).alertType,
    'Dose due reminder'
  );
  assert.equal(
    alerts.body.data.find((alert) => alert.scheduleId === upcomingSchedule._id.toString()).alertType,
    'Upcoming dose reminder'
  );
  assert.equal(alerts.body.data.some((alert) => alert.scheduleId === administeredSchedule._id.toString()), false);
  assert.equal(await MedicationAlert.countDocuments(), storedAlertsBefore);
  assert.equal((await MedicationSchedule.findById(delayedSchedule._id)).status, 'Due');
  assert.equal((await MedicationSchedule.findById(reviewSchedule._id)).status, 'Due');
  assert.equal((await MedicationSchedule.findById(dueSchedule._id)).status, 'Due');
});

test('audit log page is served and the authorized endpoint returns settings events', async () => {
  const page = await agent.get('/pages/audit-logs.html');
  assert.equal(page.status, 200);
  assert.match(page.text, /\/js\/audit-logs\.js/);

  const script = await agent.get('/js/audit-logs.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /apiFetch/);

  const logs = await agent.get('/api/v1/audit-logs');
  assert.equal(logs.status, 200);
  assert.ok(logs.body.data.some((entry) => entry.action === 'SETTINGS_UPDATE'));
});

test('nurses are denied admin-only medication operations', async () => {
  const nurseAgent = request.agent(app);
  const login = await nurseAgent.post('/api/v1/auth/login').send({
    username: 'nurse',
    password: 'Secret123!'
  });
  assert.equal(login.status, 200);

  const settingsUpdate = await nurseAgent.post('/api/v1/settings').send({ hospitalName: 'Unauthorized change' });
  assert.equal(settingsUpdate.status, 403);

  const auditLogs = await nurseAgent.get('/api/v1/audit-logs');
  assert.equal(auditLogs.status, 403);

  const openException = await MedicationException.findOne({ reviewStatus: 'Open' });
  assert.ok(openException);
  const exceptionReview = await nurseAgent.post(`/api/v1/medication-exceptions/${openException._id}/review`).send({});
  assert.equal(exceptionReview.status, 403);

  const orderVerification = await nurseAgent.post(`/api/v1/medication-orders/${orderId}/verify`).send({});
  assert.equal(orderVerification.status, 403);
});

test('reports honor facility-local date ranges and reject invalid dates', async () => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const report = await agent.get(`/api/v1/reports?from=${today}&to=${today}`);

  assert.equal(report.status, 200);
  assert.equal(report.body.data.orders, 5);
  assert.equal(report.body.data.administered, 2);
  assert.equal(report.body.data.withheld, 1);
  assert.equal(report.body.data.refused, 1);
  assert.equal(report.body.data.reconciliations, 1);
  assert.equal(report.body.data.timeZone, 'Asia/Manila');

  const invalidDate = await agent.get('/api/v1/reports?from=2026-02-31&to=2026-03-01');
  assert.equal(invalidDate.status, 400);
  const emptyDate = await agent.get('/api/v1/reports?from=&to=');
  assert.equal(emptyDate.status, 400);
});
