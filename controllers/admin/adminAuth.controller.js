import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../../models/mainDB/User.model.js";
import { ApiError } from "../../utils/apiError.js";
import sendEmail from "../../utils/sendEmail.js";

const ADMIN_OTP_TTL_MS = 5 * 60 * 1000;
const ADMIN_OTP_SESSION_TTL_MS = 30 * 60 * 1000;
const OTP_SECRET = process.env.JWT_Admin_OTP || process.env.JWT_Access_Token;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const signAdminOtpSession = (user) => {
    if (!OTP_SECRET) {
        throw new ApiError(500, "Admin OTP secret is missing");
    }

    return jwt.sign(
        { UserInfo: { id: user._id.toString() } },
        OTP_SECRET,
        { expiresIn: "30m" }
    );
};

export const requestAdminOtp = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return next(new ApiError(404, "Admin not found"));
        }

        const now = Date.now();
        const minGapMs = 30 * 1000;

        if (user.adminOtpLastRequestedAt && now - new Date(user.adminOtpLastRequestedAt).getTime() < minGapMs) {
            return next(new ApiError(429, "Please wait a few seconds before requesting a new code"));
        }

        const hourlyRequestWindowMs = 1 * 60 * 1000;
        const requestCount = user.adminOtpRequestCount || 0;
        const requestWindowStart = user.adminOtpRequestWindowStart ? new Date(user.adminOtpRequestWindowStart).getTime() : null;

        if (requestWindowStart && now - requestWindowStart < hourlyRequestWindowMs && requestCount >= 5) {
            return next(new ApiError(429, "Too many OTP requests. Please try again later."));
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp);

        user.adminOtpHash = otpHash;
        user.adminOtpExpires = new Date(now + ADMIN_OTP_TTL_MS);
        user.adminOtpLastRequestedAt = new Date(now);

        if (!requestWindowStart || now - requestWindowStart >= hourlyRequestWindowMs) {
            user.adminOtpRequestWindowStart = new Date(now);
            user.adminOtpRequestCount = 1;
        } else {
            user.adminOtpRequestCount = requestCount + 1;
        }

        await user.save();

        await sendEmail({
            email: user.email,
            subject: "Admin dashboard verification code",
            message: `
                <h2>Hello ${user.first_name || "admin"}</h2>
                <p>Your admin dashboard verification code is:</p>
                <h1 style="letter-spacing:4px; font-size:32px;">${otp}</h1>
                <p>This code expires in 5 minutes.</p>
            `,
        });

        res.status(200).json({
            success: true,
            message: "Admin verification code sent successfully",
        });
    } catch (error) {
        next(error);
    }
};

export const verifyAdminOtp = async (req, res, next) => {
    try {
        const { otp } = req.body || {};

        if (!otp) {
            return next(new ApiError(400, "OTP is required"));
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return next(new ApiError(404, "Admin not found"));
        }

        if (!user.adminOtpHash || !user.adminOtpExpires) {
            return next(new ApiError(400, "No OTP was requested. Please request a new code first."));
        }

        if (new Date(user.adminOtpExpires).getTime() < Date.now()) {
            return next(new ApiError(400, "OTP has expired. Please request a new code."));
        }

        const hashedInput = hashOtp(otp);
        if (hashedInput !== user.adminOtpHash) {
            return next(new ApiError(400, "Invalid OTP"));
        }

        const isProduction =
            process.env.NODE_ENV === "production" ||
            process.env.FRONTEND_URL?.startsWith("https://");

        const adminOtpToken = signAdminOtpSession(user);
        res.cookie("admin_otp_session", adminOtpToken, {
            httpOnly: true,
            sameSite: isProduction ? "None" : "Lax",
            secure: isProduction,
            maxAge: ADMIN_OTP_SESSION_TTL_MS,
        });

        user.adminOtpHash = undefined;
        user.adminOtpExpires = undefined;
        user.adminOtpLastRequestedAt = undefined;
        user.adminOtpRequestCount = 0;
        user.adminOtpRequestWindowStart = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            verified: true,
            message: "Admin OTP verified successfully",
        });
    } catch (error) {
        next(error);
    }
};

export const getAdminOtpStatus = async (req, res) => {
    try {
        const otpToken = req.cookies?.admin_otp_session;

        if (!otpToken) {
            return res.status(401).json({ success: false, verified: false, message: "Admin OTP session missing" });
        }

        const jwtSecret = process.env.JWT_Admin_OTP || process.env.JWT_Access_Token;
        if (!jwtSecret) {
            return res.status(500).json({ success: false, verified: false, message: "OTP secret missing" });
        }

        const decoded = jwt.verify(otpToken, jwtSecret);

        if (!decoded || !decoded.UserInfo || !decoded.UserInfo.id) {
            return res.status(401).json({ success: false, verified: false, message: "Invalid admin OTP session" });
        }

        const user = await User.findById(decoded.UserInfo.id);
        if (!user || user.role !== "admin") {
            return res.status(403).json({ success: false, verified: false, message: "Admin access required" });
        }

        return res.status(200).json({ success: true, verified: true });
    } catch (error) {
        if (error?.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, verified: false, message: "Admin OTP session expired" });
        }

        return res.status(401).json({ success: false, verified: false, message: "Invalid admin OTP session" });
    }
};
