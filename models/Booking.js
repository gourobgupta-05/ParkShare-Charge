const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
    {
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        slotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Slot",
            required: true
        },

        status: {
            type: String,
            enum: ["pending", "accepted", "ACTIVE", "completed"],
            default: "pending"
        },

        startTime: {
            type: Date
        },

        endTime: {
            type: Date
        },

        amount: {
            type: Number,
            default: 0
        },

        hasReview: {
            type: Boolean,
            default: false
        },

        checkInTime: {
            type: Date
        },

        checkInLatitude: {
            type: Number
        },

        checkInLongitude: {
            type: Number
        },

        checkInDistance: {
            type: Number
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Booking", BookingSchema);