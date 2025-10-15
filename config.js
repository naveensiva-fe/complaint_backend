const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/complaint_system";

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
  });
