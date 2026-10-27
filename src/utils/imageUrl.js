/** Build a browser-ready URL for an uploaded image. Set PUBLIC_BASE_URL to the
 * externally reachable API origin when the app is behind a proxy/load balancer.
 */
const toImageUrl = (req, imagePath) => {
    if (!imagePath) return null;
    if (/^https?:\/\//i.test(imagePath)) return imagePath;

    const baseUrl = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`)
        .replace(/\/+$/, "");
    const normalizedPath = `/${String(imagePath).replace(/\\/g, "/").replace(/^\/+/, "")}`;
    return `${baseUrl}${normalizedPath}`;
};

module.exports = { toImageUrl };
