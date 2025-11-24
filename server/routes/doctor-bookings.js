const express = require("express");
const router = express.Router();
const moment = require("moment");
const Doctor = require("../models/Doctor");
const Order = require("../models/Order");
const { authenticateUser } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const QueueState = require("../models/QueueState");

// Helper: Convert "13:30" to minutes from midnight (810)
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Helper: Convert minutes back to "01:30 PM"
const minutesToTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return moment().startOf('day').add(h, 'hours').add(m, 'minutes').format("hh:mm A");
};

// POST /api/doctor-booking/book
router.post("/book", authenticateUser, async (req, res) => {
  try {
    const { doctorId, patientId, date } = req.body; // date: "2025-11-25"
    const instId = req.user.institutionId;

    // 1. Get Doctor & Configuration
    const doc = await Doctor.findOne({ _id: doctorId, institutionId: instId });
    if (!doc) return res.status(404).json({ message: "Doctor not found" });

    // 2. Check for Leaves
    const bookingDate = moment(date);
    const onLeave = doc.leaves.some(leave => 
      bookingDate.isBetween(leave.startDate, leave.endDate, 'day', '[]')
    );
    if (onLeave) return res.status(400).json({ message: "Doctor is on leave this day." });

    // 3. Get Schedule for the specific Day (Mon, Tue...)
    const dayName = bookingDate.format("dddd"); // "Monday"
    const schedule = doc.weeklySchedule.find(s => s.day === dayName);

    if (!schedule || !schedule.isAvailable) {
      return res.status(400).json({ message: "Doctor is not available on " + dayName });
    }

    // 4. Calculate Token Number
    // Count existing bookings for this doctor on this date
    const existingBookings = await Order.countDocuments({
      institutionId: instId,
      "appointment.doctorId": doctorId,
      "appointment.date": { 
        $gte: bookingDate.startOf('day').toDate(), 
        $lte: bookingDate.endOf('day').toDate() 
      }
    });

    const newToken = existingBookings + 1;

    // 5. Calculate Estimated Time (The "Complex" Part)
    // Formula: StartTime + (PreviousPatients * AvgTime) + BreakAdjustments
    
    let startTimeMins = timeToMinutes(schedule.startTime);
    let avgTime = doc.avgTimePerPatient; // renaming from duration to avgTime for clarity

    // Basic calculation: Start + (Token-1) * AvgTime
    let tentativeTimeMins = startTimeMins + ((newToken - 1) * avgTime);

    // Get live delay
    const todayStr = bookingDate.format("YYYY-MM-DD");
    const queueState = await QueueState.findOne({ 
        institutionId: instId, doctorId: doctorId, date: todayStr 
    });

    const liveDelay = queueState ? queueState.cumulativeDelay : 0;

    // Apply delay to the calculated time
    tentativeTimeMins = tentativeTimeMins + liveDelay;

    // Check if tentative time falls inside a break
    if (schedule.breaks && schedule.breaks.length > 0) {
      for (const brk of schedule.breaks) {
        const breakStart = timeToMinutes(brk.startTime);
        const breakEnd = timeToMinutes(brk.endTime);
        const breakDuration = breakEnd - breakStart;

        // If the calculated time is AFTER the break started, we push the time forward
        // Logic: If my slot was 1:15 PM, but Lunch is 1:00-2:00, I must shift to 2:15 PM
        if (tentativeTimeMins >= breakStart) {
          tentativeTimeMins += breakDuration; 
        }
      }
    }

    const estimatedTimeStr = minutesToTime(tentativeTimeMins);

    // 6. Calculate Financials
    let docShare = 0;
    let instShare = 0;

    if (doc.employmentType === "RevenueShare") {
      docShare = (doc.consultationFee * doc.shareConfig.doctorPercentage) / 100;
      instShare = doc.consultationFee - docShare;
    } else {
      // Salaried or Private Practice
      // For Salaried: Institution takes 100% of revenue here (Salary paid separately)
      instShare = doc.consultationFee;
      docShare = 0; 
    }

    // 7. Create Order
    const newOrder = new Order({
      institutionId: instId,
      orderId: uuidv4(),
      displayId: `OPD-${moment().format("YYMMDD")}-${newToken}`,
      patientId: patientId,
      
      items: [{
        itemType: "Consultation",
        itemId: doc._id,
        name: `Consultation: ${doc.name}`,
        price: doc.consultationFee,
        financials: {
          doctorShare: docShare,
          institutionShare: instShare
        }
      }],

      appointment: {
        doctorId: doc._id,
        date: bookingDate.toDate(),
        tokenNumber: newToken,
        estimatedTime: estimatedTimeStr,
        status: "Scheduled"
      },

      totalAmount: doc.consultationFee,
      netAmount: doc.consultationFee, // Apply discounts here if needed
      paymentStatus: "Pending"
    });

    await newOrder.save();

    res.status(201).json({
      message: "Appointment Booked",
      token: newToken,
      time: estimatedTimeStr,
      doctor: doc.name
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;