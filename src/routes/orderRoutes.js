const express = require("express");

const router = express.Router();

const {
    createOrder,
    getOrders,
    getOrderById,
    deleteOrder,
} = require("../controllers/orderController");

const authMiddleware = require("../middleware/authMiddleware");

// Create order
router.post("/create-order", authMiddleware, createOrder);

// Get all orders
router.get("/get-order", authMiddleware, getOrders);

// Get single order
router.get("/get-order/:id", authMiddleware, getOrderById);

// Delete order
router.delete("/delete-order/:id", authMiddleware, deleteOrder);

module.exports = router;