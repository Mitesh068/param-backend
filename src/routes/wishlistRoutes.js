const express = require("express");

const router = express.Router();

const {
    addToWishlist,
    getWishlist,
    deleteWishlistItem,
} = require("../controllers/wishlistController");

const authMiddleware = require("../middleware/authMiddleware");

// Add product to wishlist
router.post("/create-wishlist", authMiddleware, addToWishlist);

// View wishlist
router.get("/view-wishlist", authMiddleware, getWishlist);

// Remove product from wishlist
router.delete("/delete-wishlist/:productId", authMiddleware, deleteWishlistItem);

module.exports = router;