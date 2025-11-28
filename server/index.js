const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const app = express();

const AdminMasterRoute = require("./routes/admin-master")
const AuthenticateRoute = require("./routes/authenticate")
const ConsumerAuthRoute = require("./routes/consumer-auth")
const ConsumerBookingRoute = require("./routes/consumer-booking")
const BookingsRoute = require("./routes/bookings")
const CatalogRoute = require("./routes/catalog")
const DoctorBookingRoute = require("./routes/doctor-bookings")
const InstitutionRoute = require("./routes/institutions")
const OrderRoute = require("./routes/orders")
const PaitentRoute = require("./routes/patients")
const queueManagerRoute = require("./routes/queue-manager")
const ReportRoute = require("./routes/reports")
const ServerRoute = require("./sse")
const decryptBody = require("./middleware/decryptBody");
const bodyParser = require("body-parser");
const { ConnectToDB } = require("./handlers/dbConnection");
const sseManager = require("./sse");
const { institutionMiddleware } = require("./middleware/institutionMiddleware");

// Security: Restrict CORS in production
// TODO: Replace '*' with specific domains (e.g., process.env.ALLOWED_ORIGINS.split(','))
app.use(
  cors({
    origin: "*", // Allow all for now, tighten later
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Middleware Order:
// 1. decryptBody (Must handle raw stream if encrypted)
// 2. express.json (Parses JSON if not already handled/decrypted)
app.use(decryptBody);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(institutionMiddleware());




app.use("/api/admin-master", AdminMasterRoute);
app.use("/api/authenticate", AuthenticateRoute);
app.use("/api/consumer/auth", ConsumerAuthRoute);
app.use("/api/consumer/booking", ConsumerBookingRoute);
app.use("/api/bookings", BookingsRoute);
app.use("/api/catalog", CatalogRoute);
app.use("/api/doctor-bookings", DoctorBookingRoute);
app.use("/api/institutions", InstitutionRoute);
app.use("/api/orders", OrderRoute);
app.use("/api/patients", PaitentRoute);
app.use("/api/queue-manager", queueManagerRoute);
app.use("/api/reports", ReportRoute);
app.use("/api/server",ServerRoute)

const port = process.env.PORT || 8080;


  // Start the server and connect to the database
ConnectToDB()
  .then(() => {
    app.listen(port, () => {
      // show start message only on primary PM2 instance
      if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0") {
        console.log(`Backend server is running on port ${port}`);
      }
    });

  })
  .catch((err) => {
    console.error("Failed to connect to the database", err);
  });
