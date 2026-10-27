const express = require("express");
const {
    createProduct,
    getAllProducts,
    getProductById,
    deleteProduct,
} = require("../controllers/productController");
const authenticateAdmin = require("../middleware/authMiddleware");
const uploadProductImages = require("../middleware/uploadProductMiddleware");

const router = express.Router();

router.get("/get-products", getAllProducts);
router.get("/get-product/:id", getProductById);

router.post("/create-product", authenticateAdmin, uploadProductImages.array("images", 5), createProduct);
router.delete("/delete-product/:id", authenticateAdmin, deleteProduct);

module.exports = router;