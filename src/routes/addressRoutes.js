
const express = require("express");
const router = express.Router();

const {
    addAddress,
    getAddresses,
    deleteAddress,
} = require("../controllers/addressController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/add-address", authMiddleware, addAddress);

router.get("/view-address", authMiddleware, getAddresses);

router.delete("/delete-address/:id", authMiddleware, deleteAddress);

module.exports = router;
