import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";

export const requireAdminOtp = (req, res, next) => {
    try {
        const otpToken = req.cookies?.admin_otp_session;

        if (!otpToken) {
            return next(new ApiError(401, "Admin OTP session required"));
        }

        const jwtSecret = process.env.JWT_Admin_OTP || process.env.JWT_Access_Token;
        if (!jwtSecret) {
            return next(new ApiError(500, "OTP session secret is not configured"));
        }

        const decoded = jwt.verify(otpToken, jwtSecret);

        if (!decoded || !decoded.UserInfo || !decoded.UserInfo.id) {
            return next(new ApiError(401, "Invalid admin OTP session"));
        }

        req.adminOtpUserId = decoded.UserInfo.id;
        next();
    } catch (error) {
        if (error?.name === "TokenExpiredError") {
            return next(new ApiError(401, "Admin OTP session expired"));
        }

        return next(new ApiError(401, "Invalid admin OTP session"));
    }
};
