const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const Patient = require('../../models/Patient');
const MedicationOrder = require('../../models/MedicationOrder');
const MedicationSchedule = require('../../models/MedicationSchedule');
const MedicationAdministration = require('../../models/MedicationAdministration');
const MedicationException = require('../../models/MedicationException');

const router = express.Router();

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const todayRange = { $gte: dayStart, $lt: nextDay };

    const [
      totalPatients,
      activeOrders,
      dueToday,
      dueNow,
      successfulToday,
      delayedDoses,
      missedDoses,
      refusedDoses,
      withheldDoses,
      pendingVerification,
      administrationsByStatus,
      todaySchedule,
      upcomingDoses,
      recentOrders,
      recentAdministrations
    ] = await Promise.all([
      Patient.countDocuments(),
      MedicationOrder.countDocuments({ orderStatus: 'Active' }),
      MedicationSchedule.countDocuments({ scheduledDateTime: todayRange }),
      MedicationSchedule.countDocuments({
        status: { $in: ['Due', 'Delayed'] },
        scheduledDateTime: { $lte: now }
      }),
      MedicationAdministration.countDocuments({ status: 'Administered', actualAdministrationTime: todayRange }),
      MedicationException.countDocuments({ exceptionType: 'Delayed' }),
      MedicationException.countDocuments({ exceptionType: 'Missed' }),
      MedicationException.countDocuments({ exceptionType: 'Refused' }),
      MedicationException.countDocuments({ exceptionType: 'Withheld' }),
      MedicationOrder.countDocuments({ orderStatus: 'Pending Verification' }),
      MedicationAdministration.aggregate([
        { $match: { $or: [{ actualAdministrationTime: todayRange }, { dateCreated: todayRange }] } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      MedicationSchedule.find({ scheduledDateTime: todayRange })
        .sort({ scheduledDateTime: 1 })
        .limit(8)
        .lean(),
      MedicationSchedule.find({ scheduledDateTime: { $gt: now } })
        .sort({ scheduledDateTime: 1 })
        .limit(8)
        .lean(),
      MedicationOrder.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber patientId patientName medicationName orderStatus createdAt')
        .lean(),
      MedicationAdministration.find()
        .sort({ actualAdministrationTime: -1, createdAt: -1 })
        .limit(5)
        .select('patientId medicationName status actualAdministrationTime createdAt')
        .lean()
    ]);

    const administrationCounts = Object.fromEntries(administrationsByStatus.map(({ _id, count }) => [_id, count]));
    const recentActivities = [
      ...recentOrders.map((order) => ({
        type: 'order',
        label: `Order ${order.orderNumber} · ${order.medicationName}`,
        patientName: order.patientName,
        status: order.orderStatus,
        occurredAt: order.createdAt
      })),
      ...recentAdministrations.map((record) => ({
        type: 'administration',
        label: record.medicationName,
        patientId: record.patientId,
        status: record.status,
        occurredAt: record.actualAdministrationTime || record.createdAt
      }))
    ].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0)).slice(0, 8);

    res.json({
      success: true,
      data: {
        totalPatients,
        activeOrders,
        dueToday,
        dueNow,
        successfulToday,
        delayedDoses,
        missedDoses,
        refusedDoses,
        withheldDoses,
        pendingVerification,
        administrationCounts,
        todaySchedule,
        upcomingDoses,
        recentActivities,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
