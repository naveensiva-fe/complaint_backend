const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sendMail = require("./mailer");
const PDFDocument = require("pdfkit");
require("./config");
const { UserSchema, ComplaintSchema, AssignedComplaint, MessageSchema } = require("./Schema");

const app = express();
const PORT = 8000;

/**************************************** */
// Middlewares
app.use(express.json());
app.use(cors());

/**********************************************
 * Uploads folder setup
 **********************************************/
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

/**********************************************
 * Multer storage setup
 **********************************************/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

/**********************************************
 * User Signup/Login
 **********************************************/
app.post("/SignUp", async (req, res) => {
  try {
    const user = new UserSchema(req.body);
    const savedUser = await user.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/Login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserSchema.findOne({ email });
    if (!user) return res.status(401).json({ message: "User doesn't exist" });

    if (user.password === password) res.json(user);
    else res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**********************************************
 * Complaint Registration with File Upload
 **********************************************/
app.post("/Complaint/:id", upload.single("file"), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await UserSchema.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { name, address, city, district, state, pincode, comment, status } = req.body;

    if (!name || !address || !city || !district || !state || !pincode || !comment)
      return res.status(400).json({ error: "All fields are required" });

    const complaint = new ComplaintSchema({
      userId,
      name,
      address,
      city,
      district,
      state,
      pincode,
      comment,
      status: status || "pending",
      file: req.file ? req.file.filename : null,
    });

    const savedComplaint = await complaint.save();
    res.status(201).json(savedComplaint);
  } catch (err) {
    console.error("Complaint error:", err);
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});

/**********************************************
 * Get Complaints
 **********************************************/
// All complaints
app.get("/status", async (req, res) => {
  try {
    const complaints = await ComplaintSchema.find();
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

app.get("/OrdinaryUsers/:district", async (req, res) => {
  try {
    const { district } = req.params;

    // filter users correctly
    const users = await UserSchema.find({
      userType: { $in: ["Ordinary", "User"] },
      district: district,
    });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found for this district" });
    }

    res.json(users);
  } catch (err) {
    console.error("Error fetching users by district:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


// Complaints by user
app.get("/status/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const complaints = await ComplaintSchema.find({ userId });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// Complaints by district (Admin view)
app.get("/status/district/:district", async (req, res) => {
  try {
    const { district } = req.params;
    const complaints = await ComplaintSchema.find({ district });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints by district" });
  }
});

/**********************************************
 * Agents
 **********************************************/
app.get("/AgentUsers", async (req, res) => {
  try {
    const agents = await UserSchema.find({ userType: "Agent" });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/AgentUsers/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await UserSchema.findById(agentId);
    if (!agent || agent.userType !== "Agent") return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**********************************************
 * Assign Complaint to Agent
 **********************************************/
app.post("/assignedComplaints", async (req, res) => {
  try {
    const { agentId, complaintId, status, agentName } = req.body;
    if (!agentId || !complaintId || !status || !agentName)
      return res.status(400).json({ error: "Missing fields" });

    const assigned = new AssignedComplaint({ agentId, complaintId, status, agentName });
    await assigned.save();

    await ComplaintSchema.findByIdAndUpdate(complaintId, { status });

    res.status(201).json({ message: "Complaint assigned successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign complaint" });
  }
});

/**********************************************
 * Messages (Chat)
 **********************************************/
app.post("/messages", async (req, res) => {
  try {
    const { name, message, complaintId } = req.body;
    const msg = new MessageSchema({ name, message, complaintId });
    const savedMsg = await msg.save();
    res.status(201).json(savedMsg);
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get("/messages/:complaintId", async (req, res) => {
  try {
    const messages = await MessageSchema.find({ complaintId: req.params.complaintId }).sort("-createdAt");
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**********************************************
 * Update User
 **********************************************/
app.put("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const updatedUser = await UserSchema.findByIdAndUpdate(id, { name, email, phone }, { new: true });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

/**********************************************
 * Update Complaint Status
 **********************************************/
app.put("/complaint/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;
    const updatedComplaint = await ComplaintSchema.findByIdAndUpdate(complaintId, { status }, { new: true });
    await AssignedComplaint.findOneAndUpdate({ complaintId }, { status });
    res.json(updatedComplaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

/**********************************************
 * Send Email (Admin)
 **********************************************/
app.post("/api/send-email", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) return res.status(400).json({ error: "All fields required" });

    const subject = "Message from ComplaintCare Admin";
    const html = `<div>
      <h2>Hello ${name}</h2>
      <p>${message}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Email:</b> ${email}</p>
    </div>`;

    const result = await sendMail(email, subject, html);
    if (result.success) res.json({ success: true });
    else res.status(500).json({ error: "Failed to send email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**********************************************
 * Download Complaint Report (PDF)
 **********************************************/
app.get("/download-report/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;

    // Fetch complaint details
    const complaint = await ComplaintSchema.findById(complaintId);
    if (!complaint)
      return res.status(404).json({ error: "Complaint not found" });

    // Fetch related messages
    const messages = await MessageSchema.find({ complaintId }).sort("createdAt");

    // Create PDF document
    const doc = new PDFDocument();
    const filePath = path.join(uploadDir, `Complaint_Report_${complaintId}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text("Complaint Report", { align: "center" });
    doc.moveDown(1);

    // Complaint details
    doc.fontSize(12).text(`Name: ${complaint.name}`);
    doc.text(`Address: ${complaint.address}`);
    doc.text(`City: ${complaint.city}`);
    doc.text(`District: ${complaint.district}`);
    doc.text(`State: ${complaint.state}`);
    doc.text(`Pincode: ${complaint.pincode}`);
    doc.text(`Comment: ${complaint.comment}`);
    doc.text(`Status: ${complaint.status}`);
    doc.moveDown(1);

    // If file attached
    if (complaint.file) {
      const fileUrl = path.join(__dirname, "uploads", complaint.file);
      doc.text(`Attached File: ${complaint.file}`);
      if (/\.(jpg|jpeg|png)$/i.test(complaint.file) && fs.existsSync(fileUrl)) {
        doc.moveDown(0.5);
        doc.image(fileUrl, { fit: [250, 250], align: "center" });
        doc.moveDown(1);
      }
    }

    // Messages Section
    doc.fontSize(14).text("Messages:", { underline: true });
    doc.moveDown(0.5);
    if (messages.length > 0) {
      messages.forEach((msg, index) => {
        doc.fontSize(12).text(`${index + 1}. ${msg.name}: ${msg.message}`);
      });
    } else {
      doc.fontSize(12).text("No messages found.");
    }

    doc.end();

    // Stream back to user
    stream.on("finish", () => {
      res.download(filePath, (err) => {
        if (err) console.error("Download error:", err);
        fs.unlinkSync(filePath); // delete after download
      });
    });
  } catch (error) {      
    console.error("PDF Generation Error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});
app.delete("/OrdinaryUsers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await UserSchema.findByIdAndDelete(id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/**********************************************
 * Start Server
 **********************************************/
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
