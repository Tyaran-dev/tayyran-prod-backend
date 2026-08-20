import User from "../models/mainDB/User.model.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";


export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // No token means this is a guest request. A supplied but invalid token
    // must remain an error so the client can refresh it instead of saving a
    // logged-in booking as a guest booking.
    if (!authHeader) {
        req.user = null;
        return next();
    }

    if (!authHeader.startsWith("Bearer ")) {
        return next(new ApiError(401, "Unauthorized: Invalid token format"));
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_Access_Token);

        if (!decoded?.UserInfo?.id) {
            return next(new ApiError(401, "Unauthorized: Invalid token structure"));
        }

        const user = await User.findById(decoded.UserInfo.id).select("-password");

        if (!user) {
            return next(new ApiError(401, "User not found"));
        }

        if (decoded.UserInfo.tokenVersion !== user.tokenVersion) {
            return next(new ApiError(401, "Token invalidated"));
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return next(new ApiError(401, "Token expired"));
        }

        return next(new ApiError(401, "Invalid token"));
    }
};
