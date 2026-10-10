import User from "../../models/mainDB/User.model.js";
import bcrypt from "bcrypt"
import { ApiError } from "../../utils/apiError.js";
import { parsePagination, parseDateRange,buildMeta } from "../../utils/pagination.js";
import FinalBookingTicket from "../../models/mainDB/bookings/FinalBooking.js";
import { BOOKING_LIST_FIELDS} from "../../utils/adminProjections.js"


export const getBookings = async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { search, status, bookingType, sort } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (bookingType) filter.bookingType = bookingType;

    const dateRange = parseDateRange(req.query, "createdAt");
    if (dateRange) Object.assign(filter, dateRange);

    if (search) {
        const re = new RegExp(String(search).trim(), "i");
        filter.$or = [{ invoiceId: re }, { paymentId: re }];
    }

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        value_desc: { InvoiceValue: -1 },
        value_asc: { InvoiceValue: 1 },
    };
    const sortSpec = sortMap[sort] || sortMap.newest;

    const [bookings, total] = await Promise.all([
        FinalBookingTicket.find(filter, BOOKING_LIST_FIELDS)
            .sort(sortSpec)
            .skip(skip)
            .limit(limit)
            .lean(),
        FinalBookingTicket.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, bookings, meta: buildMeta({ page, limit, total }) });
};

export const getBookingById = async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new ApiError(400, "Invalid booking id");

    const booking = await FinalBookingTicket.findById(id);
    if (!booking) throw new ApiError(404, "Booking not found");

    res.status(200).json({ success: true, booking: redactBookingProviderPayload(booking) });
};



