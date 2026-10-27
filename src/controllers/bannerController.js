const pool = require("../config/database");
const fs = require("fs");
const path = require("path");
const { toImageUrl } = require("../utils/imageUrl");


// ==================
// Create Banner
// ==================
const createBanner = async (req, res) => {
    try {
        const {
            headline,
            sub_text,
            button_text,
            button_link,
            start_date,
            end_date,
            display_frequency,
            theme,
            is_active,
        } = req.body;

        if (!headline) {
            return res.status(400).json({
                success: false,
                message: "Banner headline is required",
            });
        }

        // Image path (if uploaded)
        const storedBannerImage = req.file ? `/uploads/banners/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO banners
                (headline, sub_text, button_text, button_link, start_date, end_date, display_frequency, theme, banner_image, is_active, created_at, updated_at)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING *`,
            [
                headline.trim(),
                sub_text || null,
                button_text || null,
                button_link || null,
                start_date || null,
                end_date || null,
                display_frequency || "Once per Session",
                theme || "Festive Gold",
                storedBannerImage,
                is_active === "false" || is_active === false ? false : true,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Banner created successfully",
            banner: {
                ...result.rows[0],
                banner_image: toImageUrl(req, result.rows[0].banner_image),
            },
        });
    } catch (error) {
        console.error("Create Banner Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get All Banners
// ==================
const getAllBanners = async (req, res) => {
    try {
        const { active } = req.query; // optional filter: ?active=true

        let query = `SELECT * FROM banners`;
        const params = [];

        if (active !== undefined) {
            query += ` WHERE is_active = $1`;
            params.push(active === "true");
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            message: "Banners fetched successfully",
            count: result.rows.length,
            banners: result.rows.map((banner) => ({
                ...banner,
                banner_image: toImageUrl(req, banner.banner_image),
            })),
        });
    } catch (error) {
        console.error("Get All Banners Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Get Single Banner
// ==================
const getBannerById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM banners WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Banner not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Banner fetched successfully",
            banner: {
                ...result.rows[0],
                banner_image: toImageUrl(req, result.rows[0].banner_image),
            },
        });
    } catch (error) {
        console.error("Get Banner By Id Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==================
// Delete Banner
// ==================
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM banners WHERE id = $1 RETURNING banner_image`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Banner not found",
            });
        }

        // Delete the image file from disk too, if it exists
        const imagePath = result.rows[0].banner_image;
        if (imagePath) {
            const fullPath = path.join(__dirname, "../..", imagePath);
            fs.unlink(fullPath, (err) => {
                if (err) console.error("Failed to delete banner image file:", err.message);
            });
        }

        return res.status(200).json({
            success: true,
            message: "Banner deleted successfully",
        });
    } catch (error) {
        console.error("Delete Banner Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

module.exports = {
    createBanner,
    getAllBanners,
    getBannerById,
    deleteBanner,
};
