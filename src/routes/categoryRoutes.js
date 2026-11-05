const express = require("express");
const router = express.Router();

const {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoryTree,
    getSubCategoriesByCategory,
    createSubCategory,  
    getSubCategories,
    getSubCategoryById,
    updateSubCategory,
    deleteSubCategory
} = require("../controllers/categoryController"); 

router.post("/create-categories", createCategory);
router.get("/categories", getCategories);
router.get("/categories/tree", getCategoryTree);  
router.get("/categories/:id", getCategoryById);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);
router.get("/categories/:categoryId/sub-categories", getSubCategoriesByCategory);

router.post("/create-sub-categories", createSubCategory);
router.get("/sub-categories", getSubCategories);
router.get("/sub-categories/:id", getSubCategoryById);
router.put("/sub-categories/:id", updateSubCategory);
router.delete("/sub-categories/:id", deleteSubCategory);

module.exports = router;