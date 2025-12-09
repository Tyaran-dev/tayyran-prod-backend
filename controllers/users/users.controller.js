import User from "../../models/User.model.js";
import bcrypt from "bcrypt"
import { ApiError } from "../../utils/apiError.js";


// updateUser
// deleteUser
// getAllUsers


export const getUser = async (req, res, next) => {
    try {
        const { id } = req.body;

        if (!id) {
            return next(new ApiError(400, "User ID is required"));
        }

        // Logged-in user
        const requester = req.user;
        console.log(requester)

        // 1️⃣ If not admin, user must be requesting HIS OWN data
        if (requester.role !== "admin" && requester._id.toString() !== id) {
            return next(new ApiError(403, "Forbidden: Not allowed to access this user"));
        }

        // 2️⃣ Fetch user data
        const user = await User.findById(id)
            .select("-password")
            .populate("bookings");

        if (!user) {
            return next(new ApiError(404, "User not found"));
        }

        // 3️⃣ Success
        res.status(200).json(user);

    } catch (error) {
        return next(new ApiError(500, error.message));
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        const requester = req.user;

        // Only admin can get all users
        if (requester.role !== "admin") {
            return next(new ApiError(403, "Forbidden: Not allowed to access all users"));
        };
        const users = await User.find().select("-password").populate("bookings");

        res.status(200).json(users);
    } catch (error) {
        return next(new ApiError(500, error.message));

    }
}

export const updateUser = async (req, res, next) => {
    try {
        const userId = req.user._id; // from auth middleware
        const {
            first_name,
            last_name,
            personalInfo
        } = req.body;

        if (!userId) {
            return next(new ApiError(400, "User ID is required"));
        }

        const user = await User.findById(userId);

        if (!user) {
            return next(new ApiError(404, "User not found"));
        }

        // Build update object
        let updateData = {};

        if (first_name) updateData.first_name = first_name;
        if (last_name) updateData.last_name = last_name;

        // Handle personalInfo update (nested object)
        if (personalInfo && typeof personalInfo === "object") {
            updateData.personalInfo = {
                ...user.personalInfo.toObject(), // keep existing data
                ...personalInfo,                 // override only provided fields
                passport: {
                    ...(user.personalInfo?.passport?.toObject() || {}),
                    ...(personalInfo.passport || {})
                },
                dateOfBirth: {
                    ...(user.personalInfo?.dateOfBirth?.toObject() || {}),
                    ...(personalInfo.dateOfBirth || {})
                },
                contact: {
                    ...(user.personalInfo?.contact?.toObject() || {}),
                    ...(personalInfo.contact || {})
                }
            };
        }
        // ===================
        // UPDATE USER IN DB
        // ===================
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password");

        // Final safety check
        if (!updatedUser) {
            return next(new ApiError(500, "Failed to update user"));
        }

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: updatedUser
        });

    } catch (error) {
        return next(new ApiError(500, error.message));
    }
}

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.body;

        if (!id) {
            return next(new ApiError(400, "User ID is required"));
        }

        const requester = req.user;
        // 1️⃣ If not admin, user must be deleting HIS OWN account
        if (requester.role !== "admin" && requester._id.toString() !== id) {
            return next(new ApiError(403, "Forbidden: Not allowed to delete this user"));
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
