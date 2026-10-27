const pool = require("../config/database");
const fs = require("fs");
const path = require("path");
const { toImageUrl } = require("../utils/imageUrl");


// ==================
// Create Product
// ==================
const createProduct = async (req, res) => {
    try {
        const {
            name,
            short_description,
            detailed_description,
            price,
            compare_at_price,
            sku,
            stock_quantity,
            category,
            status,
            tags,
            visible_on_storefront,
            track_inventory,
        } = req.body;

        if (!name || !price) {
            return res.status(400).json({
                success: false,
                message: "Product name and price are required",
            });
        }

        // tags arrives as a JSON string inside form-data, e.g. '["Bestseller","New"]'
        let parsedTags = [];
        if (tags) {
            try {
                parsedTags = JSON.parse(tags);
            } catch {
                // fallback: comma-separated string like "Bestseller,New"
                parsedTags = tags.split(",").map((t) => t.trim());
            }
        }

        // Uploaded images (first one = cover image)
        const imagePaths = req.files
            ? req.files.map((file) => `/uploads/products/${file.filename}`)
            : [];

        const result = await pool.query(
            `INSERT INTO products
                (name, short_description, detailed_description, price, compare_at_price, sku, stock_quantity, category, status, tags, images, visible_on_storefront, track_inventory, created_at, updated_at)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
             RETURNING *`,
            [
                name.trim(),
                short_description || null,
                detailed_description || null,
                price,
                compare_at_price || null,
                sku || null,
                stock_quantity || 0,
                category || null,
                status || "Active",
                parsedTags,
                imagePaths,
                visible_on_storefront === "false" ? false : true,
                track_inventory === "false" ? false : true,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            product: {
                ...result.rows[0],
                images: (result.rows[0].images || []).map((image) => toImageUrl(req, image)),
            },
        });
    } catch (error) {
        console.error("Create Product Error:", error);

        // Handle duplicate SKU
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A product with this SKU already exists",
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
// Get All Products
// ==================
const getAllProducts = async (req, res) => {
    try {
        const { status, category } = req.query;

        let query = `SELECT * FROM products`;
        const conditions = [];
        const params = [];

        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }

        if (category) {
            params.push(category);
            conditions.push(`category = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            count: result.rows.length,
            products: result.rows.map((product) => ({
                ...product,
                images: (product.images || []).map((image) => toImageUrl(req, image)),
            })),
        });
    } catch (error) {
        console.error("Get All Products Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get Single Product
// ==================
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM products WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            product: {
                ...result.rows[0],
                images: (result.rows[0].images || []).map((image) => toImageUrl(req, image)),
            },
        });
    } catch (error) {
        console.error("Get Product By Id Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Delete Product
// ==================
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM products WHERE id = $1 RETURNING images`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Delete associated image files from disk
        const images = result.rows[0].images || [];
        images.forEach((imgPath) => {
            const fullPath = path.join(__dirname, "../..", imgPath);
            fs.unlink(fullPath, (err) => {
                if (err) console.error("Failed to delete product image:", err.message);
            });
        });

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        console.error("Delete Product Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    deleteProduct,
};
