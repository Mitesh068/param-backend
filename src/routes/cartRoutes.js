const express = require("express");

const router = express.Router();

const {
    addToCart,
    getCart,
    updateCartItem,
    deleteCartItem,
    clearCart,
} = require("../controllers/cartController");

const authMiddleware = require("../middleware/authMiddleware");

// Add product
router.post("/create-cart", authMiddleware, addToCart);

// View cart
router.get("/view-cart", authMiddleware, getCart);

// Update quantity
router.put("/update-cart/:productId", authMiddleware, updateCartItem);

// Delete product
router.delete("/delete-cart/:productId", authMiddleware, deleteCartItem);

// Clear cart
router.delete("/clear-cart", authMiddleware, clearCart);

module.exports = router;