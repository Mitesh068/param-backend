
const pool = require("../config/database");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const SHIPPING_CHARGE = 50;


// ==========================================
// CREATE RAZORPAY ORDER
// POST /api/payments/create-order
// ==========================================
const createPaymentOrder = async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        const { address_id, client_id } = req.body;
        const userId = client_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated customer ID not found",
            });
        }

        if (!address_id) {
            return res.status(400).json({
                success: false,
                message: "Please select a delivery address",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        // Verify address belongs to this customer
        const addressResult = await client.query(
            `SELECT *
             FROM user_addresses
             WHERE id = $1 AND user_id = $2`,
            [address_id, userId]
        );

        if (addressResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Delivery address not found",
            });
        }

        // Get customer's cart
        const cartResult = await client.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message: "Your cart is empty",
            });
        }

        const cartId = cartResult.rows[0].id;

        // Lock cart rows while calculating the amount
        const itemsResult = await client.query(
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
             FOR UPDATE OF ci, p`,
            [cartId]
        );

        const items = itemsResult.rows;

        if (items.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message: "Your cart is empty",
            });
        }

        // Validate quantities and available stock
        for (const item of items) {
            if (
                !Number.isInteger(Number(item.quantity)) ||
                Number(item.quantity) <= 0
            ) {
                throw new Error("Invalid cart quantity");
            }

            if (
                item.stock_quantity !== null &&
                Number(item.quantity) > Number(item.stock_quantity)
            ) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${item.name}`,
                });
            }
        }

        // Calculate totals on the server
        const subtotal = items.reduce(
            (sum, item) =>
                sum + Number(item.price) * Number(item.quantity),
            0
        );

        const shippingCharge = SHIPPING_CHARGE;
        const discountAmount = 0;

        const totalAmount = Number(
            (subtotal + shippingCharge - discountAmount).toFixed(2)
        );

        // Razorpay accepts amounts in paise
        const amountInPaise = Math.round(totalAmount * 100);

        if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
            throw new Error("Invalid payment amount");
        }

        const orderNumber =
            `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: orderNumber,
            notes: {
                customer_id: String(userId),
                order_number: orderNumber,
            },
        });

        // Save local order and selected address snapshot
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
                $1, $2, 'pending', 'pending', 'ONLINE',
                $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING *`,
            [
                userId,
                orderNumber,
                subtotal,
                shippingCharge,
                discountAmount,
                totalAmount,
                addressResult.rows[0].full_name,
                addressResult.rows[0].phone,
                addressResult.rows[0].email,
                [
                    addressResult.rows[0].address_line1,
                    addressResult.rows[0].address_line2,
                ].filter(Boolean).join(", "),
                addressResult.rows[0].city,
                addressResult.rows[0].state,
                addressResult.rows[0].pincode,
            ]
        );

        const order = orderResult.rows[0];

        // Save product snapshots
        for (const item of items) {
            const price = Number(item.price);
            const quantity = Number(item.quantity);

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
                    quantity,
                    price,
                    Number((price * quantity).toFixed(2)),
                ]
            );
        }

        // Save Razorpay order reference
        await client.query(
            `INSERT INTO payments (
                order_id,
                razorpay_order_id,
                amount,
                currency,
                status
            )
            VALUES ($1, $2, $3, 'INR', 'created')`,
            [order.id, razorpayOrder.id, totalAmount]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message: "Payment order created successfully",
            data: {
                order_id: order.id,
                order_number: order.order_number,
                razorpay_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key_id: process.env.RAZORPAY_KEY_ID,
                payment_status: "created",
            },
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Create payment order error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create payment order",
        });
    } finally {
        client.release();
    }
};


// ==========================================
// VERIFY RAZORPAY PAYMENT
// POST /api/payments/verify
// ==========================================
const verifyPayment = async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        const {
            client_id,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        const userId = client_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated customer ID not found",
            });
        }

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment verification details are required",
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        // Look up the Razorpay order from our database.
        // Never trust an order ID supplied by the client alone.
        const paymentResult = await client.query(
            `SELECT
                p.id AS payment_record_id,
                p.order_id,
                p.razorpay_order_id,
                p.status AS payment_status,
                o.user_id,
                o.status AS order_status,
                o.payment_status AS local_payment_status
             FROM payments p
             INNER JOIN orders o ON o.id = p.order_id
             WHERE p.razorpay_order_id = $1
               AND o.user_id = $2
             FOR UPDATE OF p, o`,
            [razorpay_order_id, userId]
        );

        if (paymentResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Payment order not found",
            });
        }

        const paymentRecord = paymentResult.rows[0];

        if (
            paymentRecord.payment_status === "paid" ||
            paymentRecord.local_payment_status === "paid"
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(200).json({
                success: true,
                message: "Payment has already been verified",
                order_id: paymentRecord.order_id,
                payment_status: "paid",
            });
        }

        // Verify signature using the server-side stored order ID
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(
                `${paymentRecord.razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest("hex");

        const receivedBuffer = Buffer.from(razorpay_signature, "hex");
        const expectedBuffer = Buffer.from(generatedSignature, "hex");

        const signatureValid =
            receivedBuffer.length === expectedBuffer.length &&
            crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

        if (!signatureValid) {
            await client.query(
                `UPDATE payments
                 SET status = 'failed',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [paymentRecord.payment_record_id]
            );

            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        // Verify actual payment status with Razorpay as well.
        const razorpayPayment =
            await razorpay.payments.fetch(razorpay_payment_id);

        if (razorpayPayment.order_id !== paymentRecord.razorpay_order_id) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message: "Payment does not match this order",
            });
        }

        if (razorpayPayment.status !== "captured") {
            await client.query(
                `UPDATE payments
                 SET razorpay_payment_id = $1,
                     status = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [
                    razorpay_payment_id,
                    razorpayPayment.status === "failed"
                        ? "failed"
                        : "created",
                    paymentRecord.payment_record_id,
                ]
            );

            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(409).json({
                success: false,
                message:
                    "Payment is not captured yet. Please check payment status or retry later.",
                payment_status: razorpayPayment.status,
            });
        }

        // Check that the payment amount matches our stored amount
        const expectedAmountResult = await client.query(
            `SELECT amount
             FROM payments
             WHERE id = $1`,
            [paymentRecord.payment_record_id]
        );

        const expectedAmountInPaise = Math.round(
            Number(expectedAmountResult.rows[0].amount) * 100
        );

        if (
            Number(razorpayPayment.amount) !== expectedAmountInPaise ||
            razorpayPayment.currency !== "INR"
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message: "Payment amount or currency mismatch",
            });
        }

        // Mark payment and order as paid
        await client.query(
            `UPDATE payments
             SET razorpay_payment_id = $1,
                 status = 'paid',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [razorpay_payment_id, paymentRecord.payment_record_id]
        );

        await client.query(
            `UPDATE orders
             SET payment_status = 'paid',
                 status = 'confirmed',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [paymentRecord.order_id, userId]
        );

        // Clear the cart only after payment is confirmed
        const cartResult = await client.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );

        if (cartResult.rows.length > 0) {
            await client.query(
                `DELETE FROM cart_items
                 WHERE cart_id = $1`,
                [cartResult.rows[0].id]
            );

            await client.query(
                `UPDATE carts
                 SET updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [cartResult.rows[0].id]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: {
                order_id: paymentRecord.order_id,
                razorpay_order_id: paymentRecord.razorpay_order_id,
                razorpay_payment_id,
                payment_status: "paid",
                order_status: "confirmed",
            },
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Verify payment error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify payment",
        });
    } finally {
        client.release();
    }
};


const getPaymentList = async (req, res) => {
    try {
        console.log("Authenticated admin:", req.admin);

        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: "Admin authentication required",
            });
        }

        const query = `
            SELECT
                p.id AS payment_record_id,
                p.order_id,
                o.order_number,
                o.user_id AS customer_id,
                p.razorpay_order_id,
                p.razorpay_payment_id,
                p.amount,
                p.currency,
                p.status AS payment_status,
                o.payment_method,
                o.total_amount,
                p.created_at
            FROM payments p
            INNER JOIN orders o ON o.id = p.order_id
            ORDER BY p.created_at DESC
        `;

        const result = await pool.query(query);

        return res.status(200).json({
            success: true,
            message: "Payment list fetched successfully",
            total: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get payment list error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment list",
        });
    }
};


module.exports = {
    createPaymentOrder,
    verifyPayment,
    getPaymentList,
};
