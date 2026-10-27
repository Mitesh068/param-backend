const pool = require("../config/database");


// ==========================================
// CREATE ORDER
// POST /api/orders
// ==========================================
const createOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }

        const {
            payment_method,
            shipping_name,
            shipping_phone,
            shipping_email,
            shipping_address,
            shipping_city,
            shipping_state,
            shipping_pincode,
            shipping_charge = 0,
            discount_amount = 0,
        } = req.body;

        // -----------------------------
        // Validate shipping details
        // -----------------------------
        if (
            !shipping_name ||
            !shipping_phone ||
            !shipping_address ||
            !shipping_city ||
            !shipping_state ||
            !shipping_pincode
        ) {
            return res.status(400).json({
                success: false,
                message: "Complete shipping details are required",
            });
        }

        await client.query("BEGIN");

        // -----------------------------
        // Get user's cart
        // -----------------------------
        const cartResult = await client.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Cart not found",
            });
        }

        const cartId = cartResult.rows[0].id;

        // -----------------------------
        // Get cart products
        // -----------------------------
        const cartItemsResult = await client.query(
            `SELECT
                ci.product_id,
                ci.quantity,
                p.name,
                p.sku,
                p.price,
                p.stock_quantity

             FROM cart_items ci

             INNER JOIN products p
                ON p.id = ci.product_id

             WHERE ci.cart_id = $1
             FOR UPDATE`,
            [cartId]
        );

        if (cartItemsResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Your cart is empty",
            });
        }

        const cartItems = cartItemsResult.rows;

        // -----------------------------
        // Check stock
        // -----------------------------
        for (const item of cartItems) {
            if (
                item.stock_quantity !== null &&
                item.quantity > item.stock_quantity
            ) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${item.name}`,
                });
            }
        }

        // -----------------------------
        // Calculate subtotal
        // -----------------------------
        const subtotal = cartItems.reduce(
            (total, item) =>
                total + Number(item.price) * Number(item.quantity),
            0
        );

        const shippingAmount = Number(shipping_charge) || 0;
        const discountAmount = Number(discount_amount) || 0;

        const totalAmount =
            subtotal +
            shippingAmount -
            discountAmount;

        if (totalAmount < 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Invalid order amount",
            });
        }

        // -----------------------------
        // Generate order number
        // -----------------------------
        const orderNumber =
            `ORD-${Date.now()}-${Math.floor(
                1000 + Math.random() * 9000
            )}`;

        // -----------------------------
        // Create order
        // -----------------------------
        const orderResult = await client.query(
            `INSERT INTO orders (
                user_id,
                order_number,
                status,
                payment_status,
                payment_method,

                subtotal,
                shipping_charge,
                discount_amount,
                total_amount,

                shipping_name,
                shipping_phone,
                shipping_email,

                shipping_address,
                shipping_city,
                shipping_state,
                shipping_pincode
            )

            VALUES (
                $1, $2, 'pending', 'pending', $3,
                $4, $5, $6, $7,
                $8, $9, $10,
                $11, $12, $13, $14
            )

            RETURNING *`,
            [
                userId,
                orderNumber,
                payment_method || null,

                subtotal,
                shippingAmount,
                discountAmount,
                totalAmount,

                shipping_name,
                shipping_phone,
                shipping_email || null,

                shipping_address,
                shipping_city,
                shipping_state,
                shipping_pincode,
            ]
        );

        const order = orderResult.rows[0];

        // -----------------------------
        // Create order items
        // -----------------------------
        for (const item of cartItems) {
            const itemTotal =
                Number(item.price) * Number(item.quantity);

            await client.query(
                `INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name,
                    sku,
                    quantity,
                    price,
                    total_price
                )

                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    order.id,
                    item.product_id,
                    item.name,
                    item.sku,
                    item.quantity,
                    item.price,
                    itemTotal,
                ]
            );

            // -----------------------------
            // Reduce product stock
            // -----------------------------
            if (item.stock_quantity !== null) {
                await client.query(
                    `UPDATE products
                     SET stock_quantity =
                         stock_quantity - $1
                     WHERE id = $2`,
                    [
                        item.quantity,
                        item.product_id,
                    ]
                );
            }
        }

        // -----------------------------
        // Clear cart
        // -----------------------------
        await client.query(
            `DELETE FROM cart_items
             WHERE cart_id = $1`,
            [cartId]
        );

        await client.query(
            `UPDATE carts
             SET updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [cartId]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Order created successfully",

            data: {
                order_id: order.id,
                order_number: order.order_number,
                status: order.status,
                payment_status: order.payment_status,
                subtotal: order.subtotal,
                shipping_charge: order.shipping_charge,
                discount_amount: order.discount_amount,
                total_amount: order.total_amount,
            },
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Create order error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });

    } finally {
        client.release();
    }
};


// ==========================================
// GET ALL ORDERS
// GET /api/orders
// ==========================================
const getOrders = async (req, res) => {
    try {
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }

        const ordersResult = await pool.query(
            `SELECT
                id,
                order_number,
                status,
                payment_status,
                payment_method,
                subtotal,
                shipping_charge,
                discount_amount,
                total_amount,
                shipping_name,
                shipping_phone,
                shipping_city,
                shipping_state,
                shipping_pincode,
                created_at,
                updated_at

             FROM orders

             WHERE user_id = $1

             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: ordersResult.rows,
            total_orders: ordersResult.rows.length,
        });

    } catch (error) {
        console.error("Get orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// GET SINGLE ORDER
// GET /api/orders/:id
// ==========================================
const getOrderById = async (req, res) => {
    try {
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }
        const { id } = req.params;

        // -----------------------------
        // Get order
        // -----------------------------
        const orderResult = await pool.query(
            `SELECT *
             FROM orders
             WHERE id = $1
             AND user_id = $2`,
            [id, userId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const order = orderResult.rows[0];

        // -----------------------------
        // Get order items
        // -----------------------------
        const itemsResult = await pool.query(
            `SELECT
                id,
                product_id,
                product_name,
                sku,
                quantity,
                price,
                total_price,
                created_at

             FROM order_items

             WHERE order_id = $1

             ORDER BY id ASC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            data: {
                order,
                items: itemsResult.rows,
            },
        });

    } catch (error) {
        console.error("Get order error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// DELETE / CANCEL ORDER
// DELETE /api/orders/:id
// ==========================================
const deleteOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.admin?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }
        const { id } = req.params;

        await client.query("BEGIN");

        // -----------------------------
        // Find order
        // -----------------------------
        const orderResult = await client.query(
            `SELECT *
             FROM orders
             WHERE id = $1
             AND user_id = $2
             FOR UPDATE`,
            [id, userId]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const order = orderResult.rows[0];

        // -----------------------------
        // Only allow pending/cancelled
        // -----------------------------
        if (
            order.status !== "pending" &&
            order.status !== "cancelled"
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Only pending or cancelled orders can be deleted",
            });
        }

        // -----------------------------
        // Delete order
        // order_items will automatically
        // delete because of ON DELETE CASCADE
        // -----------------------------
        await client.query(
            `DELETE FROM orders
             WHERE id = $1
             AND user_id = $2`,
            [id, userId]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully",
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Delete order error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });

    } finally {
        client.release();
    }
};


module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    deleteOrder,
};
