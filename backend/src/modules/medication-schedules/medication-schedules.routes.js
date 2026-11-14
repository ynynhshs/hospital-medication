const express = require('express');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationSchedule = require('../../models/MedicationSchedule');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();
const scheduleWindowMs = 30 * 24 * 60 * 60 * 1000;

function getIntervalMs(frequency) {
  if (typeof frequency !== 'string') return null;
  const normalizedFrequency = frequency.trim();
  const interval = /^every\s+(\d+)\s+hours?$/i.exec(normalizedFrequency);
  if (interval) {
    const hours = Number(interval[1]);
    if (hours >= 1 && hours <= 24) return hours * 60 * 60 * 1000;
  }

  if (/^(daily|once daily|once a day)$/i.test(normalizedFrequency)) {
    return 24 * 60 * 60 * 1000;
  }

  return null;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const schedules = await MedicationSchedule.find().sort({ scheduledDateTime: 1 });
    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', requireAuth, requireRole(['medication_admin', 'prescriber', 'pharmacist', 'nurse']), async (req, res, next) => {
  try {
    const now = new Date();
    const orders = await MedicationOrder.find({
      orderStatus: 'Active',
      verificationStatus: 'Verified',
      startDate: { $lte: new Date(now.getTime() + scheduleWindowMs) },
      prnIndicator: { $ne: true },
      $or: [{ endDate: null }, { endDate: { $gte: now } }]
    });

    const unsupportedOrders = orders.filter((order) => !getIntervalMs(order.frequency));
    if (unsupportedOrders.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Cannot generate schedules for orders with unsupported frequency formats.',
        data: {
          orders: unsupportedOrders.map((order) => ({
            orderId: order._id,
            orderNumber: order.orderNumber,
            frequency: order.frequency
          }))
        }
      });
    }

    const newSchedules = [];
    const windowEnd = new Date(now.getTime() + scheduleWindowMs);

    for (const order of orders) {
      const intervalMs = getIntervalMs(order.frequency);
      const orderStart = new Date(order.startDate);
      const end = order.endDate && order.endDate < windowEnd ? order.endDate : windowEnd;
      if (end < orderStart) continue;

      const firstIndex = Math.max(0, Math.floor((now.getTime() - orderStart.getTime()) / intervalMs));
      const firstScheduledDateTime = new Date(orderStart.getTime() + firstIndex * intervalMs);
      const existingSchedules = await MedicationSchedule.find({
        orderId: order._id,
        scheduledDateTime: { $gte: firstScheduledDateTime, $lte: end }
      }).select('scheduledDateTime').lean();
      const existingTimes = new Set(existingSchedules.map((schedule) => new Date(schedule.scheduledDateTime).getTime()));

      for (let index = firstIndex; ; index += 1) {
        const scheduledDateTime = new Date(orderStart.getTime() + index * intervalMs);
        if (scheduledDateTime > end) break;
        if (existingTimes.has(scheduledDateTime.getTime())) continue;

        newSchedules.push({
          scheduleId: `SCH-${order._id}-${scheduledDateTime.getTime()}`,
          orderId: order._id,
          patientId: order.patientId,
          patientName: order.patientName,
          medicationName: order.medicationName,
          prescribedDose: order.prescribedDose,
          route: order.route,
          scheduledDateTime,
          assignment: order.prescriberName || 'Unassigned',
          status: scheduledDateTime <= now ? 'Due' : 'Scheduled'
        });
      }
    }

    const generated = newSchedules.length ? await MedicationSchedule.insertMany(newSchedules) : [];
    res.status(201).json({ success: true, data: generated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
