import crypto from "crypto";
import RateLimitEntry from "../models/mainDB/RateLimitEntry.model.js";
import { ApiError } from "../utils/apiError.js";

const windowMs = 15 * 60 * 1000;

const createRateLimiter = ({ namespace, limit, getKey }) => async (req, res, next) => {
    const key = getKey(req);
    if (!key) {
        return next();
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowMs);
    const documentId = crypto
        .createHash("sha256")
        .update(`${namespace}:${key}`)
        .digest("hex");
    const updatePipeline = [
        {
            $set: {
                count: {
                    $cond: [
                        {
                            $gt: [
                                { $ifNull: ["$expiresAt", new Date(0)] },
                                now,
                            ],
                        },
                        {
                            $min: [
                                { $add: [{ $ifNull: ["$count", 0] }, 1] },
                                limit + 1,
                            ],
                        },
                        1,
                    ],
                },
                expiresAt: {
                    $cond: [
                        {
                            $gt: [
                                { $ifNull: ["$expiresAt", new Date(0)] },
                                now,
                            ],
                        },
                        "$expiresAt",
                        expiresAt,
                    ],
                },
            },
        },
    ];

    try {
        let entry;
        try {
            entry = await RateLimitEntry.findOneAndUpdate(
                { _id: documentId },
                updatePipeline,
                { upsert: true, new: true }
            ).exec();
        } catch (error) {
            if (error?.code !== 11000) {
                throw error;
            }

            entry = await RateLimitEntry.findOneAndUpdate(
                { _id: documentId },
                updatePipeline,
                { upsert: true, new: true }
            ).exec();
        }

        const retryAfterSeconds = Math.max(
            0,
            Math.ceil((entry.expiresAt.getTime() - now.getTime()) / 1000)
        );

        res.set({
            "RateLimit-Policy": `${limit};w=${windowMs / 1000}`,
            "RateLimit-Limit": String(limit),
            "RateLimit-Remaining": String(Math.max(0, limit - entry.count)),
            "RateLimit-Reset": String(retryAfterSeconds),
        });

        if (entry.count > limit) {
            res.set("Retry-After", String(retryAfterSeconds));
            return next(
                new ApiError(429, "Too many attempts. Please try again later.")
            );
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export const resetCodeIpRateLimit = createRateLimiter({
    namespace: "verify-reset-code:ip",
    limit: 10,
    getKey: (req) => {
        const ip = req.ip || req.socket?.remoteAddress;
        return ip ? `ip:${ip}` : null;
    },
});

export const resetCodeEmailRateLimit = createRateLimiter({
    namespace: "verify-reset-code:email",
    limit: 5,
    getKey: (req) => {
        const email = req.body?.email;
        if (typeof email !== "string" || !email.trim()) {
            return null;
        }

        return `email:${email.trim().toLowerCase()}`;
    },
});

export const loginIpRateLimit = createRateLimiter({
    namespace: "login:ip",
    limit: 10,
    getKey: (req) => {
        const ip = req.ip || req.socket?.remoteAddress;
        return ip ? ip : null;
    },
});

export const loginEmailRateLimit = createRateLimiter({
    namespace: "login:email",
    limit: 5,
    getKey: (req) => {
        const email = req.body?.email;
        if (typeof email !== "string" || !email.trim()) {
            return null;
        }

        return email.trim().toLowerCase();
    },
});

export const ensureRateLimitIndexes = () => RateLimitEntry.createIndexes();
