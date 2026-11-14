const express = require('express');
const MedicationAlert = require('../../models/MedicationAlert');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationSchedule = require('../../models/MedicationSchedule');
const Setting = require('../../models/Setting');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = express.Router();
const defaultDelayWarningMinutes = 30;
const defaultMissedDoseReviewMinutes = 120;
const defaultDoseReminderLeadMinutes = 0;
const maxGeneratedDoseAlerts = 200;

function getThresholdMinutes(settings, key, defaultValue) {
  const setting = settings.find((item) => item.key === key);
  if (!setting) return defaultValue;
  if (!Number.isInteger(setting.value) || setting.value < 0) {
    throw new Error(`The ${key} setting must be a non-negative whole number of minutes.`);
  }
  return setting.value;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const [storedAlerts, pendingOrders, settings] = await Promise.all([
      MedicationAlert.find().sort({ createdAt: -1 }).lean(),
      MedicationOrder.find({ orderStatus: 'Pending Verification' })
        .select('_id patientId orderNumber orderDate')
        .lean(),
      Setting.find({
        key: { $in: ['delayWarningThreshold', 'missedDoseReviewThreshold', 'doseReminderLeadMinutes'] }
      }).lean()
    ]);
    const pendingOrderIds = new Set(pendingOrders.map((order) => String(order._id)));
    const existingVerificationOrderIds = new Set();
    const alerts = storedAlerts.filter((alert) => {
      if (alert.alertType !== 'Medication order awaiting verification' || !alert.medicationOrderId) {
        return true;
      }
      const orderId = String(alert.medicationOrderId);
      if (!pendingOrderIds.has(orderId)) return false;
      existingVerificationOrderIds.add(orderId);
      return true;
    });

    for (const order of pendingOrders) {
      if (!existingVerificationOrderIds.has(String(order._id))) {
        alerts.push({
          patientId: order.patientId,
          medicationOrderId: order._id,
          alertType: 'Medication order awaiting verification',
          severity: 'medium',
          message: `Order ${order.orderNumber} is awaiting verification.`,
          createdAt: order.orderDate,
          reviewed: false,
          generated: true
        });
      }
    }

    const delayWarningMinutes = getThresholdMinutes(settings, 'delayWarningThreshold', defaultDelayWarningMinutes);
    const missedDoseReviewMinutes = getThresholdMinutes(
      settings,
      'missedDoseReviewThreshold',
      defaultMissedDoseReviewMinutes
    );
    const doseReminderLeadMinutes = getThresholdMinutes(
      settings,
      'doseReminderLeadMinutes',
      defaultDoseReminderLeadMinutes
    );
    const alertThresholdMinutes = Math.min(delayWarningMinutes, missedDoseReviewMinutes);
    const reminderSchedules = await MedicationSchedule.find({
      status: { $in: ['Scheduled', 'Due'] },
      scheduledDateTime: {
        $gt: new Date(now.getTime() - alertThresholdMinutes * 60 * 1000),
        $lte: new Date(now.getTime() + doseReminderLeadMinutes * 60 * 1000)
      }
    })
      .select('_id orderId patientId medicationName scheduledDateTime')
      .sort({ scheduledDateTime: 1 })
      .limit(maxGeneratedDoseAlerts + 1)
      .lean();

    for (const schedule of reminderSchedules.slice(0, maxGeneratedDoseAlerts)) {
      const scheduledDateTime = new Date(schedule.scheduledDateTime);
      const isUpcoming = scheduledDateTime > now;
      alerts.push({
        patientId: schedule.patientId,
        medicationOrderId: schedule.orderId,
        scheduleId: schedule._id,
        alertType: isUpcoming ? 'Upcoming dose reminder' : 'Dose due reminder',
        severity: 'medium',
        message: `${schedule.medicationName} is scheduled for ${scheduledDateTime.toLocaleString()}. Check the active order and record the patient's outcome.`,
        createdAt: new Date(scheduledDateTime.getTime() - (isUpcoming ? doseReminderLeadMinutes * 60 * 1000 : 0)),
        reviewed: false,
        generated: true
      });
    }

    if (reminderSchedules.length > maxGeneratedDoseAlerts) {
      alerts.push({
        alertType: 'Additional scheduled dose reminders',
        severity: 'medium',
        message: `More than ${maxGeneratedDoseAlerts} scheduled doses need attention. Open schedules to review the full list.`,
        createdAt: now,
        reviewed: false,
        generated: true
      });
    }

    const overdueSchedules = await MedicationSchedule.find({
      status: { $in: ['Scheduled', 'Due'] },
      scheduledDateTime: { $lte: new Date(now.getTime() - alertThresholdMinutes * 60 * 1000) }
    })
      .select('_id orderId patientId medicationName scheduledDateTime')
      .sort({ scheduledDateTime: 1 })
      .limit(maxGeneratedDoseAlerts + 1)
      .lean();

    for (const schedule of overdueSchedules.slice(0, maxGeneratedDoseAlerts)) {
      const scheduledDateTime = new Date(schedule.scheduledDateTime);
      const minutesLate = Math.floor((now.getTime() - scheduledDateTime.getTime()) / (60 * 1000));
      const needsReview = minutesLate >= missedDoseReviewMinutes;
      const thresholdMinutes = needsReview ? missedDoseReviewMinutes : delayWarningMinutes;
      alerts.push({
        patientId: schedule.patientId,
        medicationOrderId: schedule.orderId,
        scheduleId: schedule._id,
        alertType: needsReview ? 'Unrecorded dose requires review' : 'Dose delay warning',
        severity: 'medium',
        message: `${schedule.medicationName} was scheduled for ${scheduledDateTime.toLocaleString()} and has no administration record.`,
        createdAt: new Date(scheduledDateTime.getTime() + thresholdMinutes * 60 * 1000),
        reviewed: false,
        generated: true
      });
    }

    if (overdueSchedules.length > maxGeneratedDoseAlerts) {
      alerts.push({
        alertType: 'Additional overdue dose alerts',
        severity: 'medium',
        message: `More than ${maxGeneratedDoseAlerts} overdue doses need review. Open schedules to review the full list.`,
        createdAt: now,
        reviewed: false,
        generated: true
      });
    }

    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
