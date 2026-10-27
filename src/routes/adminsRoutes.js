const express = require("express");
const { signupAdmin, loginAdmin, getAdminDetails } = require("../controllers/adminController");
const authenticateAdmin = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/sign-up", signupAdmin);
router.post("/login", loginAdmin);
router.get("/admin-details", authenticateAdmin, getAdminDetails);

module.exports = router;