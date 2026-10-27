const pool = require("../config/database");


// =================
// Create Blog Post
// =================
const createBlog = async (req, res) => {
    try {
        const { title, content, author, status } = req.body;

        if (!title || !content || !author) {
            return res.status(400).json({
                success: false,
                message: "Title, content and author are required",
            });
        }

        const allowedStatus = ["Draft", "Published"];
        const finalStatus = allowedStatus.includes(status) ? status : "Draft";

        const result = await pool.query(
            `INSERT INTO blogs (title, content, author, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, title, content, author, status, created_at, updated_at`,
            [title.trim(), content.trim(), author.trim(), finalStatus]
        );

        return res.status(201).json({
            success: true,
            message: "Blog post created successfully",
            blog: result.rows[0],
        });
    } catch (error) {
        console.error("Create Blog Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get All Blog Posts
// ==================
const getAllBlogs = async (req, res) => {
    try {
        const { status } = req.query; // optional filter: ?status=Published

        let query = `SELECT id, title, content, author, status, created_at, updated_at FROM blogs`;
        const params = [];

        if (status) {
            query += ` WHERE status = $1`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            message: "Blogs fetched successfully",
            count: result.rows.length,
            blogs: result.rows,
        });
    } catch (error) {
        console.error("Get All Blogs Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ===================
// Get Single Blog Post
// ===================
const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, title, content, author, status, created_at, updated_at
             FROM blogs
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Blog post not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Blog fetched successfully",
            blog: result.rows[0],
        });
    } catch (error) {
        console.error("Get Blog By Id Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// =================
// Delete Blog Post
// =================
const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM blogs WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Blog post not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Blog post deleted successfully",
        });
    } catch (error) {
        console.error("Delete Blog Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

module.exports = {
    createBlog,
    getAllBlogs,
    getBlogById,
    deleteBlog,
};