import User from "../models/User.model.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";


export const protectedRoute = async (req, res, next) => {
    try {

        // 2️⃣ Or from Authorization Header (Mobile)
        const authHeader = req.headers.authorization || req.headers.Authorization; // "Bearer token"

        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const headerToken = authHeader
            ? authHeader.split(" ")[1]
            : null;

        const token = headerToken;
        if (!token) {
            return next(new ApiError(401, "Unauthorized: No token provided"));
        };

        // 4️⃣ Verify token
        const decoded = jwt.verify(token, process.env.JWT_Access_Token);

        if (!decoded?.UserInfo?.id) {
            return next(new ApiError(401, "Unauthorized: Invalid Token"));
        }

        // 5️⃣ Fetch user
        const user = await User.findById(decoded.UserInfo.id).select("-password");

 

        if (!user || decoded.UserInfo.tokenVersion !== user.tokenVersion) {
            return res.status(401).json({ message: "Token invalidated" });
        }

        // 6️⃣ Attach user to request
        req.user = user;
        next();

    } catch (error) {
        console.log(error.message, "MESSAGE");
        return next(new ApiError(500, error.message));
    }
}