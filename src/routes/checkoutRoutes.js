
const express = require("express");
const router = express.Router();

const {
    getCheckoutDetails,
    getPaymentMethods,
} = require("../controllers/checkoutController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/get-checkout-details", authMiddleware, getCheckoutDetails);

router.get("/payment-methods",authMiddleware, getPaymentMethods);

module.exports = router;
