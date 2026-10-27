const jwt = require("jsonwebtoken");

const authenticateAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required",
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid Authorization Format",
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.admin = decoded;

        next();
    } catch (error) {
        console.error("JWT Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

module.exports = authenticateAdmin;