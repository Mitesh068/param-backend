const pool = require("../config/database");

// ==================
// Helpers
// ==================
const serverError = (res, label, error) => {
    console.error(`${label} Error:`, error);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
    });
};

const notFound = (res, what) =>
    res.status(404).json({ success: false, message: `${what} not found` });

const badRequest = (res, message) =>
    res.status(400).json({ success: false, message });

// =====================================================
// CATEGORY = Brand name  (e.g. Tata, Maruti, Honda)
// =====================================================

const createCategory = async (req, res) => {
    try {
        const { name, description, status } = req.body;

        if (!name || !name.trim()) {
            return badRequest(res, "Category name is required");
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
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists",
            });
        }
        return serverError(res, "Create Category", error);
    }
};

// All categories with sub category count
const getCategories = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, COUNT(s.id)::int AS sub_category_count
             FROM categories c
             LEFT JOIN sub_categories s ON s.category_id = c.id
             GROUP BY c.id
             ORDER BY c.name ASC`
        );

        return res.status(200).json({
            success: true,
            message: "Categories fetched successfully",
            count: result.rows.length,
            categories: result.rows,
        });
    } catch (error) {
        return serverError(res, "Get Categories", error);
    }
};

// Category tree: every category with its sub categories nested inside
const getCategoryTree = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*,
                    COALESCE(
                        json_agg(s ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL),
                        '[]'
                    ) AS sub_categories
             FROM categories c
             LEFT JOIN sub_categories s ON s.category_id = c.id
             GROUP BY c.id
             ORDER BY c.name ASC`
        );

        return res.status(200).json({
            success: true,
            message: "Category tree fetched successfully",
            count: result.rows.length,
            categories: result.rows,
        });
    } catch (error) {
        return serverError(res, "Get Category Tree", error);
    }
};

// Single category with its sub categories
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const categoryResult = await pool.query(
            `SELECT * FROM categories WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (categoryResult.rows.length === 0) {
            return notFound(res, "Category");
        }

        const subResult = await pool.query(
            `SELECT * FROM sub_categories WHERE category_id = $1 ORDER BY name ASC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            category: { ...categoryResult.rows[0], sub_categories: subResult.rows },
        });
    } catch (error) {
        return serverError(res, "Get Category By Id", error);
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status } = req.body;

        if (!name || !name.trim()) {
            return badRequest(res, "Category name is required");
        }

        const result = await pool.query(
            `UPDATE categories
             SET name = $1, description = $2, status = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [name.trim(), description || null, status || "Active", id]
        );

        if (result.rows.length === 0) {
            return notFound(res, "Category");
        }

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            category: result.rows[0],
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists",
            });
        }
        return serverError(res, "Update Category", error);
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM categories WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return notFound(res, "Category");
        }

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                success: false,
                message: "Cannot delete category that still has sub categories. Delete them first.",
            });
        }
        return serverError(res, "Delete Category", error);
    }
};

// =====================================================
// SUB CATEGORY = Vehicle name  (e.g. Nexon, Swift, City)
// =====================================================

const createSubCategory = async (req, res) => {
    try {
        const { category_id, name, description, status } = req.body;

        if (!category_id) {
            return badRequest(res, "Category (category_id) is required");
        }
        if (!name || !name.trim()) {
            return badRequest(res, "Sub category name is required");
        }

        const result = await pool.query(
            `INSERT INTO sub_categories (category_id, name, description, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING *`,
            [category_id, name.trim(), description || null, status || "Active"]
        );

        return res.status(201).json({
            success: true,
            message: "Sub category created successfully",
            sub_category: result.rows[0],
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This sub category already exists under the selected category",
            });
        }
        if (error.code === "23503") {
            return badRequest(res, "Selected category does not exist");
        }
        return serverError(res, "Create Sub Category", error);
    }
};

// All sub categories, optionally filtered: GET /sub-categories?category_id=1
const getSubCategories = async (req, res) => {
    try {
        const { category_id } = req.query;
        const params = [];
        let where = "";

        if (category_id) {
            params.push(category_id);
            where = "WHERE s.category_id = $1";
        }

        const result = await pool.query(
            `SELECT s.*, c.name AS category_name
             FROM sub_categories s
             JOIN categories c ON c.id = s.category_id
             ${where}
             ORDER BY c.name ASC, s.name ASC`,
            params
        );

        return res.status(200).json({
            success: true,
            message: "Sub categories fetched successfully",
            count: result.rows.length,
            sub_categories: result.rows,
        });
    } catch (error) {
        return serverError(res, "Get Sub Categories", error);
    }
};

// Dependent dropdown: GET /categories/:categoryId/sub-categories
const getSubCategoriesByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const result = await pool.query(
            `SELECT * FROM sub_categories WHERE category_id = $1 ORDER BY name ASC`,
            [categoryId]
        );

        return res.status(200).json({
            success: true,
            message: "Sub categories fetched successfully",
            count: result.rows.length,
            sub_categories: result.rows,
        });
    } catch (error) {
        return serverError(res, "Get Sub Categories By Category", error);
    }
};

const getSubCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT s.*, c.name AS category_name
             FROM sub_categories s
             JOIN categories c ON c.id = s.category_id
             WHERE s.id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return notFound(res, "Sub category");
        }

        return res.status(200).json({
            success: true,
            message: "Sub category fetched successfully",
            sub_category: result.rows[0],
        });
    } catch (error) {
        return serverError(res, "Get Sub Category By Id", error);
    }
};

const updateSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, description, status } = req.body;

        if (!category_id) {
            return badRequest(res, "Category (category_id) is required");
        }
        if (!name || !name.trim()) {
            return badRequest(res, "Sub category name is required");
        }

        const result = await pool.query(
            `UPDATE sub_categories
             SET category_id = $1, name = $2, description = $3, status = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [category_id, name.trim(), description || null, status || "Active", id]
        );

        if (result.rows.length === 0) {
            return notFound(res, "Sub category");
        }

        return res.status(200).json({
            success: true,
            message: "Sub category updated successfully",
            sub_category: result.rows[0],
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This sub category already exists under the selected category",
            });
        }
        if (error.code === "23503") {
            return badRequest(res, "Selected category does not exist");
        }
        return serverError(res, "Update Sub Category", error);
    }
};

const deleteSubCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM sub_categories WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return notFound(res, "Sub category");
        }

        return res.status(200).json({
            success: true,
            message: "Sub category deleted successfully",
        });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                success: false,
                message: "Cannot delete sub category that is still in use",
            });
        }
        return serverError(res, "Delete Sub Category", error);
    }
};

module.exports = {
    // category (brand)
    createCategory,
    getCategories,
    getCategoryTree,
    getCategoryById,
    updateCategory,
    deleteCategory,
    // sub category (vehicle)
    createSubCategory,
    getSubCategories,
    getSubCategoriesByCategory,
    getSubCategoryById,
    updateSubCategory,
    deleteSubCategory,
};