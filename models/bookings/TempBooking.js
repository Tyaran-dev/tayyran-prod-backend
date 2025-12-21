// models/TempBooking.js
import mongoose from "mongoose";

const TempBookingSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    bookingType: {
      type: String,
      enum: ["flight", "hotel"],
      required: true,
    },
    bookingData: {
      type: Object, // can store either flightData or hotelData
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "authorized", "failed"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60, // Auto-delete after 1 hour
    },
  },
  { timestamps: true }
);

const TempBookingTicket = mongoose.model(
  "TempBookingTicket",
  TempBookingSchema
);

export default TempBookingTicket;
