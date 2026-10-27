const bcrypt = require("bcrypt");
const pool = require("../config/database");
const generateToken = require("../utils/generateToken");


// =================
// Signup Admin
// =================
const signupAdmin = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, phone number and password are required",
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        const phoneRegex = /^\+?[0-9]{10,15}$/;
        if (!phoneRegex.test(phone.trim())) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            });
        }

        const existing = await pool.query(
            `SELECT id FROM admin WHERE LOWER(email) = LOWER($1) OR phone = $2 LIMIT 1`,
            [email.trim(), phone.trim()]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Admin with this email or phone number already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO admin (name, email, phone, password, role, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, true, NOW())
             RETURNING id, name, email, phone, role, is_active, created_at`,
            [name.trim(), email.trim(), phone.trim(), hashedPassword, "admin"]
        );

        const newAdmin = result.rows[0];
        const token = generateToken(newAdmin);

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully",
            token,
            admin: newAdmin,
        });
    } catch (error) {
        console.error("Admin Signup Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// =================
// Login Admin
// =================
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                name,
                email,
                password,
                role,
                is_active,
                created_at
            FROM admin
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1`,
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = generateToken(admin);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                is_active: admin.is_active,
            },
        });
    } catch (error) {
        console.error("Admin Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get Admin Details
// ==================
const getAdminDetails = async (req, res) => {
    try {
        if (!req.admin || !req.admin.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: admin not authenticated",
            });
        }

        const adminId = req.admin.id;

        const result = await pool.query(
            `SELECT 
              id,
              name,
              email,
              role,
              is_active,
              created_at
            FROM admin
            WHERE id = $1
            LIMIT 1`,
            [adminId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin Not Found",
            });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Admin details fetched successfully",
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                is_active: admin.is_active,
                created_at: admin.created_at,
            },
        });
    } catch (error) {
        console.error("Get Admin Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

module.exports = {
    signupAdmin,
    loginAdmin,
    getAdminDetails,
};