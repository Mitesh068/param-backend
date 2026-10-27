const express = require("express");
const {
    createBanner,
    getAllBanners,
    getBannerById,
    deleteBanner,
} = require("../controllers/bannerController");
const authenticateAdmin = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware")

const router = express.Router();

// Public: view banners (e.g. for storefront popup)
router.get("/get-banner", getAllBanners);
router.get("/get-bannerby-id/:id", getBannerById);

// Protected: only admins can create/delete
router.post("/create-banner", authenticateAdmin, upload.single("banner_image"), createBanner);
router.delete("/delete-banner/:id", authenticateAdmin, deleteBanner);

module.exports = router;