const jwt = require("jsonwebtoken");

const generateToken = (admin) => {
    return jwt.sign(
        {
            id: admin.id,
            email: admin.email,
            role: admin.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        }
    );
};

module.exports = generateToken;