import User from "../models/mainDB/User.model.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";

export const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return next(new ApiError(403, "Forbidden: Admin access required"));
    }
    next();

}