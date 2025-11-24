const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

let dbConnection = null;
let connectingPromise = null;

const ConnectToDB = async () => {
  if (dbConnection) return dbConnection;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      dbConnection = mongoose.connection;
      console.log("Database Connected");
      connectingPromise = null;
      return dbConnection;
    } catch (error) {
      console.error("Database connection error:", error);
      connectingPromise = null;
      // schedule a retry after 5s (do not block; callers can call ConnectToDB again)
      setTimeout(() => {
        // call but ignore result here; callers should re-call ConnectToDB if needed
        ConnectToDB().catch(() => {});
      }, 5000);
      throw error; // let the caller know this attempt failed
    }
  })();

  return connectingPromise;
};

const getConnection = () => dbConnection;

module.exports = {
  ConnectToDB,
  getConnection,
};
