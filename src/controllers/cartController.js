const pool = require("../config/database");

// ==========================================
// ADD TO CART
// POST /api/cart
// ==========================================
const addToCart = async (req, res) => {
    try {
        const userId = req.admin.id;
        const { product_id, quantity = 1 } = req.body;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be greater than 0",
            });
        }

        // Check product exists
        const productResult = await pool.query(
            `SELECT id, name, price, stock_quantity
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

        const product = productResult.rows[0];

        // Check stock
        if (
            product.stock_quantity !== null &&
            quantity > product.stock_quantity
        ) {
            return res.status(400).json({
                success: false,
                message: "Requested quantity is not available",
            });
        }

        // Find existing cart
        let cartResult = await pool.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1`,
            [userId]
        );

        let cartId;

        // Create cart if doesn't exist
        if (cartResult.rows.length === 0) {
            const newCart = await pool.query(
                `INSERT INTO carts (user_id)
                 VALUES ($1)
                 RETURNING id`,
                [userId]
            );

            cartId = newCart.rows[0].id;
        } else {
            cartId = cartResult.rows[0].id;
        }

        // Check whether product already exists
        const existingItem = await pool.query(
            `SELECT id, quantity
             FROM cart_items
             WHERE cart_id = $1
             AND product_id = $2`,
            [cartId, product_id]
        );

        if (existingItem.rows.length > 0) {
            const newQuantity =
                existingItem.rows[0].quantity + Number(quantity);

            if (
                product.stock_quantity !== null &&
                newQuantity > product.stock_quantity
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Requested quantity exceeds available stock",
                });
            }

            await pool.query(
                `UPDATE cart_items
                 SET quantity = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [newQuantity, existingItem.rows[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO cart_items
                 (cart_id, product_id, quantity)
                 VALUES ($1, $2, $3)`,
                [cartId, product_id, quantity]
            );
        }

        // Update cart updated_at
        await pool.query(
            `UPDATE carts
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [cartId]
        );

        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
        });
    } catch (error) {
        console.error("Add to cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// VIEW CART
// GET /api/cart
// ==========================================
const getCart = async (req, res) => {
    try {
        const userId = req.admin.id;

        const result = await pool.query(
            `SELECT
                c.id AS cart_id,
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,
                p.name,
                p.price,
                p.compare_at_price,
                p.sku,
                p.stock_quantity,

                (p.price * ci.quantity) AS item_total

             FROM carts c

             INNER JOIN cart_items ci
                ON c.id = ci.cart_id

             INNER JOIN products p
                ON p.id = ci.product_id

             WHERE c.user_id = $1

             ORDER BY ci.created_at DESC`,
            [userId]
        );

        const items = result.rows;

        const subtotal = items.reduce(
            (total, item) => total + Number(item.item_total),
            0
        );

        const totalQuantity = items.reduce(
            (total, item) => total + Number(item.quantity),
            0
        );

        return res.status(200).json({
            success: true,
            data: {
                items,
                total_items: items.length,
                total_quantity: totalQuantity,
                subtotal,
            },
        });
    } catch (error) {
        console.error("Get cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// UPDATE CART PRODUCT
// PUT /api/cart/:productId
// ==========================================
const updateCartItem = async (req, res) => {
    try {
        const userId = req.admin.id;
        const { productId } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be greater than 0",
            });
        }

        // Check product
        const productResult = await pool.query(
            `SELECT id, stock_quantity
             FROM products
             WHERE id = $1`,
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        const product = productResult.rows[0];

        if (
            product.stock_quantity !== null &&
            quantity > product.stock_quantity
        ) {
            return res.status(400).json({
                success: false,
                message: "Quantity exceeds available stock",
            });
        }

        // Update only user's cart
        const result = await pool.query(
            `UPDATE cart_items ci

             SET quantity = $1,
                 updated_at = CURRENT_TIMESTAMP

             FROM carts c

             WHERE ci.cart_id = c.id
             AND c.user_id = $2
             AND ci.product_id = $3

             RETURNING ci.*`,
            [quantity, userId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found in cart",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart product updated successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Update cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// DELETE PRODUCT FROM CART
// DELETE /api/cart/:productId
// ==========================================
const deleteCartItem = async (req, res) => {
    try {
        const userId = req.admin.id;
        const { productId } = req.params;

        const result = await pool.query(
            `DELETE FROM cart_items ci

             USING carts c

             WHERE ci.cart_id = c.id
             AND c.user_id = $1
             AND ci.product_id = $2

             RETURNING ci.*`,
            [userId, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found in cart",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product removed from cart successfully",
        });
    } catch (error) {
        console.error("Delete cart item error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// CLEAR CART
// DELETE /api/cart
// ==========================================
const clearCart = async (req, res) => {
    try {
        const userId = req.admin.id;

        const result = await pool.query(
            `DELETE FROM cart_items ci
             USING carts c
             WHERE ci.cart_id = c.id
             AND c.user_id = $1`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "Cart cleared successfully",
            deleted_items: result.rowCount,
        });
    } catch (error) {
        console.error("Clear cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    deleteCartItem,
    clearCart,
};
