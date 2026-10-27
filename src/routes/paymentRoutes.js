
const express = require("express");
const router = express.Router();

const {
    createPaymentOrder,
    verifyPayment,
    getPaymentList,
} = require("../controllers/paymentController");

const authenticateCustomer = require("../middleware/authMiddleware");

router.post(
    "/create-payment",
    authenticateCustomer,
    createPaymentOrder
);

router.post(
    "/verify-payment",
    authenticateCustomer,
    verifyPayment
);

router.get(
    "/payment-list",
    authenticateCustomer,
    getPaymentList
);

module.exports = router;
