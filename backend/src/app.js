const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const buildSessionMiddleware = require('./config/session');
const authRoutes = require('./modules/auth/auth.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const patientRoutes = require('./modules/patients/patients.routes');
const catalogRoutes = require('./modules/medication-catalog/medication-catalog.routes');
const orderRoutes = require('./modules/medication-orders/medication-orders.routes');
const reconciliationRoutes = require('./modules/medication-reconciliation/medication-reconciliation.routes');
const scheduleRoutes = require('./modules/medication-schedules/medication-schedules.routes');
const adminRoutes = require('./modules/medication-administration/medication-administration.routes');
const exceptionRoutes = require('./modules/medication-exceptions/medication-exceptions.routes');
const historyRoutes = require('./modules/medication-history/medication-history.routes');
const alertRoutes = require('./modules/medication-alerts/medication-alerts.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const auditRoutes = require('./modules/audit-logs/audit-logs.routes');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', apiLimiter);
app.use(buildSessionMiddleware());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/medication-catalog', catalogRoutes);
app.use('/api/v1/medication-orders', orderRoutes);
app.use('/api/v1/medication-reconciliation', reconciliationRoutes);
app.use('/api/v1/medication-schedules', scheduleRoutes);
app.use('/api/v1/medication-administration', adminRoutes);
app.use('/api/v1/medication-exceptions', exceptionRoutes);
app.use('/api/v1/medication-history', historyRoutes);
app.use('/api/v1/medication-alerts', alertRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Medication system API is healthy.', data: { status: 'ok' } });
});

app.use('/pages', express.static(path.join(__dirname, '../../frontend/pages')));
app.use('/css', express.static(path.join(__dirname, '../../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../../frontend/js')));
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found.' });
});

app.use((error, req, res, next) => {
  const isValidationError = error && error.name === 'ZodError';
  if (!isValidationError) console.error(error);

  const status = isValidationError ? 400 : error.statusCode || error.status || 500;
  const message = isValidationError ? 'Invalid request.' : error.message || 'An unexpected error occurred.';
  const response = { success: false, message };
  if (isValidationError) {
    response.errors = error.issues.map(({ path, message: issueMessage }) => ({
      path,
      message: issueMessage
    }));
  }
  res.status(status).json(response);
});

module.exports = app;
