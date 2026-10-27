const express = require("express");
const router = express.Router();

const {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
} = require("../controllers/categoryController"); // adjust path/filename if different

router.post("/create-category", createCategory);
router.get("/get-categories", getCategories);
router.get("/get-category/:id", getCategoryById);
router.put("/update-category/:id", updateCategory);
router.delete("/delete-category/:id", deleteCategory);

module.exports = router;