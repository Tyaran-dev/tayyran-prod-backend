import User from "../../models/mainDB/User.model.js";
import bcrypt from "bcrypt"
import { ApiError } from "../../utils/apiError.js";
import { parsePagination, buildMeta, parseDateRange } from "../../utils/pagination.js";
import {
    USER_LIST_FIELDS,

} from "../../utils/adminProjections.js";

export const getAllUsers = async (req, res, next) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { search, role, membershipStatus, emailVerified } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (membershipStatus) filter.membershipStatus = membershipStatus;
    if (emailVerified === "true" || emailVerified === "false") {
        filter.emailVerified = emailVerified === "true";
    }
    if (search) {
        const re = new RegExp(String(search).trim(), "i");
        filter.$or = [{ name: re }, { email: re }];
    }

    const [users, total] = await Promise.all([
        User.find(filter, USER_LIST_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, users, meta: buildMeta({ page, limit, total }) });
}

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.body;
        if (!id) {
            return next(new ApiError(400, "User ID is required"));
        }
        // 2️⃣ Delete user
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return next(new ApiError(404, "User not found"));
        }

        res.status(200).json({ message: "User deleted successfully" });

    } catch (error) {
        return next(new ApiError(500, error.message));
    }
}
