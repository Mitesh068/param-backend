
const express = require("express");
const router = express.Router();

const {
    createShiprocketOrder,
    checkServiceability,
    assignAWB,
    requestPickup,
    trackShipment,
} = require("../controllers/shiprocketController");

// If your project has customer authentication middleware,
// import it and apply it to these routes.
const authenticateCustomer = require("../middleware/authMiddleware");

router.post(
    "/create-order",
    authenticateCustomer,
    createShiprocketOrder
);

router.get(
    "/serviceability",
    authenticateCustomer,
    checkServiceability
);

router.post(
    "/assign-awb",
    authenticateCustomer,
    assignAWB
);

router.post(
    "/request-pickup",
    authenticateCustomer,
    requestPickup
);

router.get(
    "/track/:awb",
    authenticateCustomer,
    trackShipment
);

module.exports = router;
