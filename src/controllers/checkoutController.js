
const pool = require("../config/database");

const SHIPPING_CHARGE = 50;

// ==========================================
// GET CHECKOUT DETAILS
// POST /api/checkout
// ==========================================
const getCheckoutDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { address_id, payment_method } = req.body;

        const allowedMethods = ["COD", "ONLINE"];

        if (!address_id) {
            return res.status(400).json({
                success: false,
                message: "Please select a delivery address",
            });
        }

        if (
            payment_method &&
            !allowedMethods.includes(payment_method)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method",
            });
        }

        // 1. Fetch the selected address belonging to this user
        const addressResult = await pool.query(
            `SELECT
                id,
                full_name,
                phone,
                email,
                address_line1,
                address_line2,
                city,
                state,
                pincode,
                country,
                address_type,
                is_default
             FROM user_addresses
             WHERE id = $1 AND user_id = $2`,
            [address_id, userId]
        );

        if (addressResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Selected address not found",
            });
        }

        // 2. Get the user's cart
        const cartResult = await pool.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty",
            });
        }

        // 3. Fetch cart products and current prices
        const itemsResult = await pool.query(
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
             ORDER BY ci.created_at DESC`,
            [cartResult.rows[0].id]
        );

        if (itemsResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty",
            });
        }

        const items = itemsResult.rows.map((item) => {
            const price = Number(item.price);
            const quantity = Number(item.quantity);

            return {
                product_id: item.product_id,
                name: item.name,
                sku: item.sku,
                price,
                quantity,
                item_total: Number((price * quantity).toFixed(2)),
                stock_quantity: item.stock_quantity,
                in_stock:
                    item.stock_quantity === null ||
                    quantity <= Number(item.stock_quantity),
            };
        });

        const unavailableItems = items.filter(
            (item) => !item.in_stock
        );

        const subtotal = Number(
            items.reduce(
                (sum, item) => sum + item.item_total,
                0
            ).toFixed(2)
        );

        // Replace these with your actual shipping/discount rules.
        const shippingCharge = SHIPPING_CHARGE;
        const discountAmount = 0;

        const totalAmount = Number(
            (subtotal + shippingCharge - discountAmount).toFixed(2)
        );

        return res.status(200).json({
            success: true,
            message: "Checkout details fetched successfully",
            data: {
                address: addressResult.rows[0],
                items,
                summary: {
                    total_items: items.length,
                    total_quantity: items.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                    ),
                    subtotal,
                    shipping_charge: shippingCharge,
                    discount_amount: discountAmount,
                    total_amount: totalAmount,
                    currency: "INR",
                },
                payment: {
                    selected_method: payment_method || null,
                    available_methods: [
                        {
                            code: "COD",
                            name: "Cash on Delivery",
                            enabled: true,
                        },
                        {
                            code: "ONLINE",
                            name: "Online Payment",
                            enabled: true,
                            gateway_required: true,
                        },
                    ],
                    can_place_order: unavailableItems.length === 0,
                },
                unavailable_items: unavailableItems.map((item) => ({
                    product_id: item.product_id,
                    name: item.name,
                    requested_quantity: item.quantity,
                    available_quantity: item.stock_quantity,
                })),
            },
        });
    } catch (error) {
        console.error("Checkout details error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// GET AVAILABLE PAYMENT METHODS
// GET /api/checkout/payment-methods
// ==========================================
const getPaymentMethods = async (req, res) => {
    return res.status(200).json({
        success: true,
        data: [
            {
                code: "COD",
                name: "Cash on Delivery",
                enabled: true,
            },
            {
                code: "ONLINE",
                name: "Online Payment",
                enabled: true,
                gateway_required: true,
            },
        ],
    });
};

module.exports = {
    getCheckoutDetails,
    getPaymentMethods,
};
