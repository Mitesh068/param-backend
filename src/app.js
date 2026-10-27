require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const pool = require("./config/database");
const adminRoutes = require("./routes/adminsRoutes");
const blogRoutes = require("./routes/blogroutes");
const bannerRoutes = require("./routes/bannerRoute");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes")
const CartRoutes = require("./routes/cartRoutes")
const WishlistRoutes = require("./routes/wishlistRoutes")
const orderRoutes = require("./routes/orderRoutes")
const addressRoutes = require("./routes/addressRoutes")
const checkoutRoutes = require("./routes/checkoutRoutes");
const PaymentRoutes = require("./routes/paymentRoutes")
const shiprocketRoutes = require("./routes/shiprocketRoutes");
const authenticateAdmin = require("./middleware/authMiddleware");


const app = express();

// Middleware
app.use(express.json());
// Multer stores files in the project-root uploads directory (../uploads from src).
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Test API
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is running",
    });
});

app.use(
    cors({
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Test database
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.status(200).json({
            success: true,
            message: "Database connected successfully",
            databaseTime: result.rows[0].now,
        });
    } catch (error) {
        console.error(
            "Error occurred while testing database connection:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Error occurred while testing database connection",
        });
    }
});

// TEMPORARY DEBUG ROUTE — remove once schema mismatches are resolved
app.get("/api/debug-columns/:tableName", async (req, res) => {
    try {
        const { tableName } = req.params;

        const dbInfo = await pool.query(
            "SELECT current_database() AS db, current_schema() AS schema"
        );

        const result = await pool.query(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns 
             WHERE table_name = $1
             ORDER BY ordinal_position`,
            [tableName]
        );

        res.status(200).json({
            success: true,
            connectedTo: dbInfo.rows[0],
            table: tableName,
            columnCount: result.rows.length,
            columns: result.rows,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Routes
app.use("/api/admin", adminRoutes)
app.use("/api/blogs", blogRoutes)
app.use("/api/banners", bannerRoutes)
app.use("/api/products", productRoutes)
app.use("/api/category", categoryRoutes)
app.use("/api/cart", CartRoutes)
app.use("/api/wishlist", WishlistRoutes)
app.use("/api/checkout", checkoutRoutes)
app.use("/api/order", orderRoutes)
app.use("/api/addresses", addressRoutes)
app.use("/api/payment", PaymentRoutes)
app.use("/api/shiprocket", shiprocketRoutes)

// Protected admin profile
app.get(  
    "/api/admin/profile",
    authenticateAdmin,
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Admin authenticated successfully",
            admin: req.admin,
        });
    }
);

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
