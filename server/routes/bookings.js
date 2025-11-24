// routes/bookings.js
const express = require("express");
const router = express.Router();
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/Order");
const Patient = require("../models/Patient");
const Test = require("../models/Test");
const Package = require("../models/Package");
const { authenticateUser } = require("../middleware/auth");

// Mock "SMS" Sender
const sendNotification = (mobile, message) => {
  console.log("---------------------------------------------------");
  console.log(`📱 SMS TO [${mobile}]: ${message}`);
  console.log("---------------------------------------------------");
};

// POST /api/bookings/create
router.post("/create", authenticateUser, async (req, res) => {
  try {
    const { 
      patientId, 
      items, // Tests or Packages
      appointmentType, // 'Walk-In' or 'Home-Collection'
      scheduledDate, // YYYY-MM-DD
      address // Only for Home Collection
    } = req.body;

    const instId = req.user.institutionId;

    // 1. Calculate Costs & Build Item List (Same as Orders logic)
    // ... (Use the loop provided in the previous orders.js to calculate totalAmount and build items list) ...
    // *Assuming you have the logic to build `orderTestsWorklist` and `totalAmount` here*
    
    // (Simulating items logic for brevity - COPY FROM orders.js)
    let totalAmount = 0; 
    let orderTestsWorklist = [];
    // ... insert loop logic here ...

    // 2. Queue & Slot Logic
    let appointmentDetails = {
      type: appointmentType,
      scheduledDate: moment(scheduledDate).toDate(),
    };

    if (appointmentType === 'Walk-In') {
      // Find how many Walk-Ins exist for this date
      const startOfDay = moment(scheduledDate).startOf('day').toDate();
      const endOfDay = moment(scheduledDate).endOf('day').toDate();

      const existingCount = await Order.countDocuments({
        institutionId: instId,
        "appointment.type": "Walk-In",
        "appointment.scheduledDate": { $gte: startOfDay, $lte: endOfDay }
      });

      const tokenNumber = existingCount + 1;
      
      // Calculate Time: Assume Lab opens at 9:00 AM, 15 mins per slot
      // 9:00 AM + (Token-1 * 15 min)
      const labOpenTime = moment(scheduledDate).set({ hour: 9, minute: 0, second: 0 });
      const slotStart = labOpenTime.clone().add((tokenNumber - 1) * 15, 'minutes');
      const slotEnd = slotStart.clone().add(15, 'minutes');

      appointmentDetails.tokenNumber = tokenNumber;
      appointmentDetails.estimatedTimeSlot = `${slotStart.format("hh:mm A")} - ${slotEnd.format("hh:mm A")}`;
    
    } else if (appointmentType === 'Home-Collection') {
      // For home collection, we don't give exact slot instantly, we give a window
      appointmentDetails.address = address;
      appointmentDetails.estimatedTimeSlot = "7:00 AM - 11:00 AM (Runner will call)";
      appointmentDetails.collectionStatus = "Pending";
    }

    // 3. Create the Booking (Order)
    const newOrder = new Order({
      institutionId: instId,
      orderId: uuidv4(),
      displayId: `BK-${moment().format("YYMMDD")}-${Math.floor(Math.random()*1000)}`, // Temporary ID
      patientId,
      tests: orderTestsWorklist, // Populated from item loop
      totalAmount,
      netAmount: totalAmount,
      status: "Booked", // Not yet 'Confirmed' or 'Processing'
      appointment: appointmentDetails
    });

    await newOrder.save();
    
    // 4. Send Notifications
    const patient = await Patient.findById(patientId);
    
    if (appointmentType === 'Walk-In') {
      sendNotification(
        patient.mobile, 
        `Booking Confirmed! Your Token is #${appointmentDetails.tokenNumber}. Please reach lab by ${appointmentDetails.estimatedTimeSlot}.`
      );
    } else {
      sendNotification(
        patient.mobile, 
        `Home Collection Booked for ${moment(scheduledDate).format("DD MMM")}. Our phlebotomist will contact you.`
      );
      // Notify Admin
      console.log(`🔔 ADMIN ALERT: New Home Collection Request at ${address.city}`);
    }

    res.status(201).json({ 
      message: "Booking successful", 
      bookingId: newOrder.displayId,
      slot: appointmentDetails.estimatedTimeSlot,
      token: appointmentDetails.tokenNumber
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;