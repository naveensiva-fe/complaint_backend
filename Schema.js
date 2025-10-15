// backend/Schema.js
const mongoose = require("mongoose");

///////////////// User Schema ///////////////////////////
const userSchema = mongoose.Schema(
  {
    name: { type: String, required: "Name is required" },
    email: { type: String, required: "Email is required" },
    password: { type: String, required: "Password is required" },
    phone: { type: Number, required: "Phone is required" },
    userType: { type: String, required: "UserType is required" }, // "Admin", "Agent", "Ordinary"
    district: { type: String, required: false }, // ✅ added for filtering
  },
  { timestamps: true }
);

const UserSchema = mongoose.model("user_Schema", userSchema);

///////////////// Complaint Schema ///////////////////////
const complaintSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "user_Schema" },
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: Number, required: true },
    comment: { type: String, required: true },
    status: { type: String, default: "pending" },
    file: { type: String, default: null },
  },
  { timestamps: true }
);

const ComplaintSchema = mongoose.model("complaint_schema", complaintSchema);

///////////////// Assigned Complaint Schema //////////////
const assignedComplaint = mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "user_Schema" },
    complaintId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "complaint_schema" },
    status: { type: String, required: true },
    agentName: { type: String, required: true },
  },
  { timestamps: true }
);

const AssignedComplaint = mongoose.model("assigned_complaint", assignedComplaint);

///////////////// Chat / Message Schema //////////////////
const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: "Name is required" },
    message: { type: String, required: "Message is required" },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "assigned_complaint" },
  },
  { timestamps: true }
);

const MessageSchema = mongoose.model("message", messageSchema);

module.exports = {
  UserSchema,
  ComplaintSchema,
  AssignedComplaint,
  MessageSchema,
};
