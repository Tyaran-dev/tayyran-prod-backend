import express from "express";
import { protectedRoute } from "../../middlewares/protectedRoute.js";
import { authorizeRoles } from "../../middlewares/authorizeRoles.js";
import { requireAdminOtp } from "../../middlewares/requireAdminOtp.js";
const router = express.Router();

import { getAllUsers } from "../../controllers/admin/manageusers.controller.js";
import { getOverview } from "../../controllers/admin/dashboard.controller.js";
import { getBookings, getBookingById } from "../../controllers/admin/managebookings.controller.js";
import { requestAdminOtp, verifyAdminOtp, getAdminOtpStatus } from "../../controllers/admin/adminAuth.controller.js";

router.post("/auth/otp/request", protectedRoute, authorizeRoles("admin"), requestAdminOtp);
router.post("/auth/otp/verify", protectedRoute, authorizeRoles("admin"), verifyAdminOtp);
router.get("/auth/otp/status", protectedRoute, authorizeRoles("admin"), getAdminOtpStatus);

router.get("/getusers", protectedRoute, authorizeRoles("admin"), requireAdminOtp, getAllUsers);
router.get("/overview", protectedRoute, authorizeRoles("admin"), requireAdminOtp, getOverview);

// bookings
router.get("/bookings", protectedRoute, authorizeRoles("admin"), requireAdminOtp, getBookings);
router.get("/bookings/:id", protectedRoute, authorizeRoles("admin"), requireAdminOtp, getBookingById);

export default router;