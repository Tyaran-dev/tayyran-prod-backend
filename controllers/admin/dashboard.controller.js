import mongoose from "mongoose";
import { ApiError } from "../../utils/apiError.js";
import  User  from "../../models/mainDB/User.model.js";
import FinalBookingTicket from "../../models/mainDB/bookings/FinalBooking.js";
import {
    USER_LIST_FIELDS,
    BOOKING_LIST_FIELDS,
} from "../../utils/adminProjections.js";


export const getOverview = async (req, res) => {
    const [userStats, bookingStats, recentBookings, recentUsers] = await Promise.all([
        User.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    members: { $sum: { $cond: [{ $eq: ["$role", "member"] }, 1, 0] } },
                    admins: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
                    verified: { $sum: { $cond: [{ $eq: ["$emailVerified", true] }, 1, 0] } },
                },
            },
        ]),
        FinalBookingTicket.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "confirmed"] }, "$InvoiceValue", 0],
                        },
                    },
                },
            },
        ]),
        FinalBookingTicket.find({}, BOOKING_LIST_FIELDS).sort({ createdAt: -1 }).limit(5).lean(),
        User.find({}, USER_LIST_FIELDS).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    res.status(200).json({
        success: true,
        users: userStats[0]
            ? {
                total: userStats[0].total,
                members: userStats[0].members,
                admins: userStats[0].admins,
                verified: userStats[0].verified,
            }
            : { total: 0, members: 0, admins: 0, verified: 0 },
        bookings: bookingStats[0]
            ? {
                total: bookingStats[0].total,
                confirmed: bookingStats[0].confirmed,
                failed: bookingStats[0].failed,
                revenue: bookingStats[0].revenue,
            }
            : { total: 0, confirmed: 0, failed: 0, revenue: 0 },
        recentBookings,
        recentUsers,
    });
};