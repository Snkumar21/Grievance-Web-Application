require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");
const { body, validationResult } = require('express-validator');

const app = express();

// MySQL Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",   
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Snkumar30",
    database: process.env.DB_NAME || "grievance_system",
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL Database');
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// JWT Authentication Middleware
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ success: false, message: "No token provided." });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: "Failed to authenticate token." });
        req.userId = decoded.userId;
        next();
    });
};

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "snkumar6926@gmail.com",
        pass: process.env.EMAIL_PASS || "fimb vpam ranv gjyt"
    }
});

// Function to Send Email
async function sendApprovalEmail(userEmail, grievanceTitle) {
    let mailOptions = {
        from: process.env.EMAIL_USER || "your-email@gmail.com",
        to: userEmail,
        subject: "Grievance Approved ✔",
        text: `Hello, your grievance titled "${grievanceTitle}" has been approved successfully! 🎉`
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// Approve Grievance & Send Email
app.post('/approveGrievance', (req, res) => {
    const { grievanceId, grievanceTitle } = req.body;

    console.log("Received Approve Request for ID:", grievanceId);

    if (!grievanceId) {
        return res.status(400).json({ success: false, message: "Grievance ID is required." });
    }

    const fetchEmailQuery = "SELECT user_email FROM grievances WHERE id = ?";
    db.query(fetchEmailQuery, [grievanceId], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error fetching user email:", err);
            return res.status(500).json({ success: false, message: "Error fetching user email." });
        }

        const userEmail = results[0].user_email;
        console.log("User Email Found:", userEmail);

        const updateQuery = "UPDATE grievances SET status = 'under-implementation' WHERE id = ?";
        db.query(updateQuery, [grievanceId], async (err) => {
            if (err) {
                console.error("Error updating grievance:", err);
                return res.status(500).send("Error approving grievance.");
            }

            console.log("Database Updated! Sending email...");
            await sendApprovalEmail(userEmail, grievanceTitle);

            res.status(200).json({ success: true, message: "Grievance approved and email sent successfully!" });
        });
    });
});

// User Registration
app.post('/register', (req, res) => {
    const { name, email, phone, password } = req.body;

    const checkUserQuery = "SELECT * FROM users WHERE email = ?";
    db.query(checkUserQuery, [email], (err, result) => {
        if (err) return res.status(500).send("Error checking user existence.");
        if (result.length > 0) return res.status(400).json({ success: false, message: "User already exists." });

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).send("Error hashing password.");
            
            const query = "INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)";
            db.query(query, [name, email, phone, hash], (err) => {
                if (err) return res.status(500).send("Error registering user.");
                res.status(201).json({ success: true, message: "User registered successfully." });
            });
        });
    });
});

// User Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], (err, result) => {
        if (err) {
            console.error("Error querying database:", err);
            return res.status(500).json({ success: false, message: "Internal server error." });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const user = result[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error("Error comparing password:", err);
                return res.status(500).json({ success: false, message: "Internal server error." });
            }

            if (!isMatch) {
                return res.status(401).json({ success: false, message: "Invalid password." });
            }

            // Send user data on successful login
            return res.status(200).json({
                success: true,
                message: "Login successful.",
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            });
        });
    });
});

// Fetch all grievances for the admin-dashboard
app.get('/grievances', (req, res) => {
    const query = "SELECT id, user_email As email, title, status FROM grievances";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching grievances:", err);
            return res.status(500).send("Error fetching grievances.");
        }
        res.status(200).json(results);
    });
});

// Submit Grievance
app.post('/submit-grievance', async (req, res) => {
    const { email, title, description } = req.body;
    if (!email || !title || !description) return res.status(400).json({ success: false, message: "All fields are required." });

    const query = "INSERT INTO grievances (user_email, title, description, status) VALUES (?, ?, ?, 'unchecked')";
    db.query(query, [email, title, description], (err, results) => {
        if (err) {
            console.error("Error inserting grievance:", err);
            return res.status(500).json({ success: false, message: "Error submitting grievance." });
        }
        res.status(200).json({ success: true, message: "Grievance submitted successfully." });
    });
});

// Fetch grievances for the user-dashboard
app.get('/user-grievances', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });

    const query = "SELECT * FROM grievances WHERE user_email = ?";
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("Error fetching grievances:", err);
            return res.status(500).json({ success: false, message: "Error fetching grievances." });
        }
        res.status(200).json(results);
    });
});

// Approve Grievance
app.post('/approveGrievance', (req, res) => {
    const { grievanceId } = req.body;

    const query = "UPDATE grievances SET status = 'under-implementation' WHERE id = ?";
    db.query(query, [grievanceId], (err) => {
        if (err) return res.status(500).send("Error approving grievance.");
        res.status(200).json({ success: true, message: "Grievance approved successfully." });
    });
});

// Reject Grievance
app.post('/rejectGrievance', (req, res) => {
    const { grievanceId } = req.body;

    const query = "UPDATE grievances SET status = 'completed' WHERE id = ?";
    db.query(query, [grievanceId], (err) => {
        if (err) return res.status(500).send("Error rejecting grievance.");
        res.status(200).json({ success: true, message: "Grievance rejected successfully." });
    });
});

// Serve Static Pages
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "user-login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "public", "user-register.html")));

// Start Server
app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});