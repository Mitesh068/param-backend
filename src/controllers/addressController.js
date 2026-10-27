
const pool = require("../config/database");

// ==========================================
// ADD ADDRESS
// POST /api/addresses
// ==========================================
const addAddress = async (req, res) => {
    try {
        const userId = req.admin?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }

        const {
            full_name,
            phone,
            email,
            address_line1,
            address_line2,
            city,
            state,
            pincode,
            country = "India",
            address_type = "home",
            is_default = false,
        } = req.body;

        if (
            !full_name ||
            !phone ||
            !address_line1 ||
            !city ||
            !state ||
            !pincode
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required address details",
            });
        }

        if (!["home", "work", "other"].includes(address_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid address type",
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // If this is the default address, unset the
            // previous default for this user.
            if (is_default === true) {
                await client.query(
                    `UPDATE user_addresses
                     SET is_default = FALSE,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1`,
                    [userId]
                );
            }

            const result = await client.query(
                `INSERT INTO user_addresses (
                    user_id,
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
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12
                )
                RETURNING *`,
                [
                    userId,
                    full_name,
                    phone,
                    email || null,
                    address_line1,
                    address_line2 || null,
                    city,
                    state,
                    pincode,
                    country,
                    address_type,
                    is_default === true,
                ]
            );

            await client.query("COMMIT");

            return res.status(201).json({
                success: true,
                message: "Address added successfully",
                data: result.rows[0],
            });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Add address error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// SHOW ALL ADDRESSES
// GET /api/addresses
// ==========================================
const getAddresses = async (req, res) => {
    try {
        const userId = req.admin?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM user_addresses
             WHERE user_id = $1
             ORDER BY is_default DESC, created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "Addresses fetched successfully",
            total_addresses: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get addresses error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ==========================================
// DELETE ADDRESS
// DELETE /api/addresses/:id
// ==========================================
const deleteAddress = async (req, res) => {
    try {
        const userId = req.admin?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM user_addresses
             WHERE id = $1
               AND user_id = $2
             RETURNING id`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Address deleted successfully",
        });
    } catch (error) {
        console.error("Delete address error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


module.exports = {
    addAddress,
    getAddresses,
    deleteAddress,
};
