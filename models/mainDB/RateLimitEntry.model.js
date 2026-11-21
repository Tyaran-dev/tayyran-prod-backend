import { Schema } from "mongoose";
import { mainConnection } from "../../db/connectMongoDB.js";

const rateLimitEntrySchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        count: {
            type: Number,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        versionKey: false,
        autoIndex: false,
    }
);

rateLimitEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitEntry = mainConnection.model(
    "RateLimitEntry",
    rateLimitEntrySchema,
    "rate_limit_entries"
);

export default RateLimitEntry;
