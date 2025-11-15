
module.exports = function apiKeyMiddleware(req, res, next) {
    const key = req.headers['x-api-key'];

    if (!key) {
        return res.status(401).json({ error: "API Key missing" });
    }

    if (key !== process.env.API_KEY) {
        return res.status(403).json({ error: "Invalid API Key" });
    }

    next();
};
