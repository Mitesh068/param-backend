const pool = require("../config/database");

// ==================
// Create Category
// ==================
const createCategory = async (req, res) => {
    try {
        const { name, description, status } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required",
            });
        }

        const result = await pool.query(
            `INSERT INTO categories (name, description, status, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING *`,
            [name.trim(), description || null, status || "Active"]
        );

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            category: result.rows[0],
        });
    } catch (error) {
        console.error("Create Category Error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get Categories (flat list)
// ==================
const getCategories = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM categories ORDER BY name ASC`
        );

        return res.status(200).json({
            success: true,
            message: "Categories fetched successfully",
            count: result.rows.length,
            categories: result.rows,
        });
    } catch (error) {
        console.error("Get Categories Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get Single Category
// ==================
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM categories WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            category: result.rows[0],
        });
    } catch (error) {
        console.error("Get Category By Id Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Update Category
// ==================
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required",
            });
        }

        const result = await pool.query(
            `UPDATE categories
             SET name = $1, description = $2, status = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [name.trim(), description || null, status || "Active", id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            category: result.rows[0],
        });
    } catch (error) {
        console.error("Update Category Error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Delete Category
// ==================
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM categories WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (error) {
        console.error("Delete Category Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
};