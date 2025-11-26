const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderItemSchema = new mongoose.Schema({
  // Type is CRITICAL now
  itemType: { type: String, enum: ["Test", "Package", "Consultation"], required: true },
  
  // ID of the Test OR the Doctor
  itemId: { type: String, required: true }, 
  name: { type: String }, // "CBC" or "Dr. Sweetheart Consultation"
  
  price: Number, // The amount billed to patient (e.g., 1000)
  
  // === NEW: Financial Split (Calculated at booking) ===
  financials: {
    doctorShare: { type: Number, default: 0 },      // e.g., 700
    institutionShare: { type: Number, default: 0 }  // e.g., 300
  },

  // Lab Results (If itemType == Test)
  results: [mongoose.Schema.Types.Mixed],
  
  // Consultation Notes (If itemType == Consultation)
  consultationNotes: { type: String }, 
  prescription: {
      url: { type: String }, // For image uploads
      text: { type: String }, // For typed prescriptions
      medicines: [{
          name: String,
          dosage: String,
          frequency: String, // e.g., 1-0-1
          duration: String, // e.g., 5 Days
          instruction: String // e.g., Before Food
      }]
  },

  status: { type: String, default: "Pending" }
});

const orderSchema = new mongoose.Schema({
  institutionId: { type: String, required: true, index: true },
  orderId: { type: String, default: () => uuidv4(), unique: true },
  displayId: { type: String }, 
  
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  
  // === UPDATED APPOINTMENT LOGIC ===
  appointment: {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }, // Link to Doctor
    date: { type: Date },
    tokenNumber: { type: Number }, // Queue Serial: #13
    estimatedTime: { type: String }, // "11:45 AM"
    status: { type: String, default: "Scheduled" } // Scheduled, Checked-In, Completed
  },
  
  items: [orderItemSchema], // Can be [Consultation] OR [Test, Test] OR [Consultation, Test]
  
  totalAmount: Number,
  netAmount: Number,
  paymentStatus: { type: String, default: "Pending" },
  
}, { timestamps: true });

module.exports = orderSchema;