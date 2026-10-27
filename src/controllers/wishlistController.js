const pool = require("../config/database");

// ==========================================
// ADD TO WISHLIST
// POST /api/wishlist
// ==========================================
const addToWishlist = async (req, res) => {
    try {
        // authMiddleware verifies the Bearer token and stores its identity on req.admin.
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "A valid authentication token is required",
            });
        }
        const { product_id } = req.body;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        // Check product exists
        const productResult = await pool.query(
            `SELECT id
             FROM products
             WHERE id = $1`,
            [product_id]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Find user's wishlist
        let wishlistResult = await pool.query(
            `SELECT id
             FROM wishlists
             WHERE user_id = $1`,
            [userId]
        );

        let wishlistId;

        // Create wishlist if it doesn't exist
        if (wishlistResult.rows.length === 0) {
            const newWishlist = await pool.query(
                `INSERT INTO wishlists (user_id)
                 VALUES ($1)
                 RETURNING id`,
                [userId]
            );

            wishlistId = newWishlist.rows[0].id;
        } else {
            wishlistId = wishlistResult.rows[0].id;
        }

        // Check whether product is already in wishlist
        const existingItem = await pool.query(
            `SELECT id
             FROM wishlist_items
             WHERE wishlist_id = $1
             AND product_id = $2`,
            [wishlistId, product_id]
        );

        if (existingItem.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Product is already in wishlist",
            });
        }

        // Add product
        const result = await pool.query(
            `INSERT INTO wishlist_items
             (wishlist_id, product_id)
             VALUES ($1, $2)
             RETURNING *`,
            [wishlistId, product_id]
        );

        // Update wishlist timestamp
        await pool.query(
            `UPDATE wishlists
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [wishlistId]
        );

        return res.status(201).json({
            success: true,
            message: "Product added to wishlist successfully",
            data: result.rows[0],
        });

    } catch (error) {
        console.error("Add wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// VIEW WISHLIST
// GET /api/wishlist
// ==========================================
const getWishlist = async (req, res) => {
    try {
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "A valid authentication token is required",
            });
        }

        const result = await pool.query(
            `SELECT
                w.id AS wishlist_id,
                wi.id AS wishlist_item_id,
                wi.product_id,
                wi.created_at AS added_at,

                p.name,
                p.short_description,
                p.detailed_description,
                p.price,
                p.compare_at_price,
                p.sku,
                p.stock_quantity,
                p.category,
                p.status,
                p.tags,
                p.visible_on_storefront,
                p.track_inventory

             FROM wishlists w

             INNER JOIN wishlist_items wi
                ON w.id = wi.wishlist_id

             INNER JOIN products p
                ON p.id = wi.product_id

             WHERE w.user_id = $1

             ORDER BY wi.created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: {
                items: result.rows,
                total_items: result.rows.length,
            },
        });

    } catch (error) {
        console.error("Get wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// DELETE FROM WISHLIST
// DELETE /api/wishlist/:productId
// ==========================================
const deleteWishlistItem = async (req, res) => {
    try {
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "A valid authentication token is required",
            });
        }
        const { productId } = req.params;

        const result = await pool.query(
            `DELETE FROM wishlist_items wi

             USING wishlists w

             WHERE wi.wishlist_id = w.id
             AND w.user_id = $1
             AND wi.product_id = $2

             RETURNING wi.*`,
            [userId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found in wishlist",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product removed from wishlist successfully",
        });

    } catch (error) {
        console.error("Delete wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


module.exports = {
    addToWishlist,
    getWishlist,
    deleteWishlistItem,
};
