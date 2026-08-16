const Booking = require("../models/Booking");
const Slot = require("../models/Slot");

const autoCheckIn = async (req, res) => {
    console.log("NEW CHECKIN CONTROLLER RUNNING");

    try {
        const {
            bookingId,
            driverLatitude,
            driverLongitude
        } = req.body;

        // Check required data
        if (
            !bookingId ||
            driverLatitude === undefined ||
            driverLongitude === undefined
        ) {
            return res.status(400).json({
                message:
                    "bookingId, driverLatitude and driverLongitude are required"
            });
        }

        // Find booking
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // Find the parking slot connected to the booking
        const slot = await Slot.findById(booking.slotId);

        if (!slot) {
            return res.status(404).json({
                message: "Parking slot not found"
            });
        }

        // Check that slot location exists
        if (
            !slot.location ||
            !slot.location.coordinates ||
            slot.location.coordinates.length !== 2
        ) {
            return res.status(500).json({
                message: "Parking slot location is invalid"
            });
        }

        // GeoJSON coordinates are [longitude, latitude]
        const slotLongitude = slot.location.coordinates[0];
        const slotLatitude = slot.location.coordinates[1];

        // Convert degrees to radians
        const toRadians = (degree) => degree * (Math.PI / 180);

        // Earth's radius in meters
        const R = 6371000;

        const lat1 = toRadians(slotLatitude);
        const lat2 = toRadians(Number(driverLatitude));

        const differenceLatitude =
            toRadians(Number(driverLatitude) - slotLatitude);

        const differenceLongitude =
            toRadians(Number(driverLongitude) - slotLongitude);

        // Haversine formula
        const a =
            Math.sin(differenceLatitude / 2) *
                Math.sin(differenceLatitude / 2) +
            Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(differenceLongitude / 2) *
                Math.sin(differenceLongitude / 2);

        const c =
            2 * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        const distance = R * c;

        // 15-meter geofence
        if (distance <= 15) {
            booking.status = "ACTIVE";

            await booking.save();

            return res.json({
                message: "Auto Check-In Successful",
                distance: `${distance.toFixed(2)} meters`,
                geofence: "INSIDE 15 meters",
                bookingStatus: "ACTIVE",
                booking: booking
            });
        }

        // Driver is outside the geofence
        return res.json({
            message: "Driver outside geofence area",
            distance: `${distance.toFixed(2)} meters`,
            geofence: "OUTSIDE 15 meters",
            bookingStatus: booking.status,
            booking: booking
        });

    } catch (error) {
        console.error("Auto Check-In Error:", error);

        res.status(500).json({
            error: error.message
        });
    }
};

module.exports = {
    autoCheckIn
};