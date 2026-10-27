const express = require("express");
const {
    createBlog,
    getAllBlogs,
    getBlogById,
    deleteBlog,
} = require("../controllers/blogcontroller");
const authenticateAdmin = require("../middleware/authMiddleware");

const router = express.Router();

// Public: anyone can view blogs
router.get("/blogs", getAllBlogs);
router.get("/blog-details/:id", getBlogById);

// Protected: only logged-in admins can create/delete
router.post("/add-blogs", authenticateAdmin, createBlog);
router.delete("/delet-blog/:id", authenticateAdmin, deleteBlog);

module.exports = router;