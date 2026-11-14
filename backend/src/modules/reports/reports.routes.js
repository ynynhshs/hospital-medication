const express = require('express');
const MedicationAdministration = require('../../models/MedicationAdministration');
const MedicationException = require('../../models/MedicationException');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationSchedule = require('../../models/MedicationSchedule');
const MedicationReconciliation = require('../../models/MedicationReconciliation');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = express.Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDate(value, endExclusive = false) {
  if (!datePattern.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (endExclusive) date.setDate(date.getDate() + 1);
  return date;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    let dateRange = null;
    const hasFrom = Object.prototype.hasOwnProperty.call(req.query, 'from');
    const hasTo = Object.prototype.hasOwnProperty.call(req.query, 'to');
    if (hasFrom || hasTo) {
      const from = hasFrom ? parseLocalDate(String(req.query.from)) : new Date(0);
      const to = hasTo ? parseLocalDate(String(req.query.to), true) : new Date(8640000000000000);
      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'Report dates must use valid YYYY-MM-DD values.' });
      }
      if (from >= to) {
        return res.status(400).json({ success: false, message: 'The report start date must be on or before its end date.' });
      }
      dateRange = { $gte: from, $lt: to };
    }

    const ordersFilter = dateRange ? { orderDate: dateRange } : {};
    const administrationsFilter = dateRange
      ? { status: 'Administered', actualAdministrationTime: dateRange }
      : { status: 'Administered' };
    const exceptionsFilter = dateRange ? { dateTime: dateRange } : {};
    const schedulesFilter = dateRange ? { scheduledDateTime: dateRange } : {};
    const reconciliationsFilter = dateRange ? { dateTime: dateRange } : {};

    const [orders, administered, delayed, missed, refused, withheld, scheduled, reconciliations] = await Promise.all([
      MedicationOrder.countDocuments(ordersFilter),
      MedicationAdministration.countDocuments(administrationsFilter),
      MedicationException.countDocuments({ ...exceptionsFilter, exceptionType: 'Delayed' }),
      MedicationException.countDocuments({ ...exceptionsFilter, exceptionType: 'Missed' }),
      MedicationException.countDocuments({ ...exceptionsFilter, exceptionType: 'Refused' }),
      MedicationException.countDocuments({ ...exceptionsFilter, exceptionType: 'Withheld' }),
      MedicationSchedule.countDocuments(schedulesFilter),
      MedicationReconciliation.countDocuments(reconciliationsFilter)
    ]);

    res.json({
      success: true,
      data: {
        orders,
        administered,
        delayed,
        missed,
        refused,
        withheld,
        scheduled,
        reconciliations,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
