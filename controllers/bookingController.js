const Booking = require("../models/Booking");
const Slot = require("../models/Slot");
// Create Booking
exports.createBooking = async (req, res) => {
    try {
        const booking = await Booking.create(req.body);

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};


// Get all Bookings
exports.getBookings = async (req, res) => {
    try {
        const bookings = await Booking.find()
            
            .populate({
                path: "slotId",
                populate: {
                    path: "hostId",
                    model: "Host"
                }
            });

        res.json(bookings);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};


// Get Booking Details
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            
            .populate({
                path: "slotId",
                populate: {
                    path: "hostId",
                    model: "Host"
                }
            });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        res.json(booking);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};


// Auto Check-In
// Auto Check-In using GPS
exports.autoCheckIn = async (req, res) => {
    try {
        const {
            driverLatitude,
            driverLongitude,
            accuracy
        } = req.body;

        // =====================================================
        // 1. Validate GPS coordinates
        // =====================================================

        if (
            driverLatitude === undefined ||
            driverLongitude === undefined
        ) {
            return res.status(400).json({
                message: "Driver latitude and longitude are required"
            });
        }

        if (
            typeof driverLatitude !== "number" ||
            typeof driverLongitude !== "number"
        ) {
            return res.status(400).json({
                message: "Latitude and longitude must be numbers"
            });
        }

        // Valid geographic ranges
        if (
            driverLatitude < -90 ||
            driverLatitude > 90 ||
            driverLongitude < -180 ||
            driverLongitude > 180
        ) {
            return res.status(400).json({
                message: "Invalid GPS coordinates"
            });
        }

        // =====================================================
        // 2. Validate GPS accuracy
        // =====================================================

        if (
            accuracy !== undefined &&
            (
                typeof accuracy !== "number" ||
                accuracy < 0
            )
        ) {
            return res.status(400).json({
                message: "Invalid GPS accuracy"
            });
        }

        // =====================================================
        // 3. Find booking
        // =====================================================

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // =====================================================
        // 4. Prevent duplicate check-in
        // =====================================================

        if (booking.status === "ACTIVE") {
            return res.status(409).json({
                message: "Booking is already ACTIVE",
                status: booking.status,
                checkInTime: booking.checkInTime,
                checkInLatitude: booking.checkInLatitude,
                checkInLongitude: booking.checkInLongitude,
                checkInDistance: booking.checkInDistance
            });
        }

        // =====================================================
        // 5. Booking must be accepted
        // =====================================================

        if (booking.status !== "accepted") {
            return res.status(400).json({
                message:
                    `Booking cannot be checked in because its current status is ${booking.status}`
            });
        }

        // =====================================================
        // 6. Validate booking time
        // =====================================================

        const now = new Date();

        if (booking.startTime && now < booking.startTime) {
            return res.status(400).json({
                message: "Check-in is not available yet",
                bookingStartTime: booking.startTime,
                currentTime: now
            });
        }

        if (booking.endTime && now > booking.endTime) {
            return res.status(400).json({
                message: "Booking time has already ended",
                bookingEndTime: booking.endTime,
                currentTime: now
            });
        }

        // =====================================================
        // 7. Find slot
        // =====================================================

        const slot = await Slot.findById(booking.slotId);

        if (!slot) {
            return res.status(404).json({
                message: "Slot not found"
            });
        }

        // =====================================================
        // 8. Validate slot coordinates
        // =====================================================

        if (
            !slot.location ||
            !slot.location.coordinates ||
            slot.location.coordinates.length !== 2
        ) {
            return res.status(400).json({
                message:
                    "Slot does not have valid location coordinates"
            });
        }

        // GeoJSON:
        // coordinates = [longitude, latitude]

        const slotLongitude =
            slot.location.coordinates[0];

        const slotLatitude =
            slot.location.coordinates[1];

        // =====================================================
        // 9. Haversine distance calculation
        // =====================================================

        const toRadians = (degrees) => {
            return degrees * (Math.PI / 180);
        };

        const EARTH_RADIUS = 6371000;

        const dLat = toRadians(
            driverLatitude - slotLatitude
        );

        const dLon = toRadians(
            driverLongitude - slotLongitude
        );

        const a =
            Math.sin(dLat / 2) *
                Math.sin(dLat / 2) +

            Math.cos(toRadians(slotLatitude)) *
                Math.cos(toRadians(driverLatitude)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        const distance =
            EARTH_RADIUS * c;

        // =====================================================
        // 10. 15-meter geofence
        // =====================================================

        if (distance > 15) {
            return res.status(400).json({
                message:
                    "Driver is outside the 15 meter check-in radius",

                distance:
                    `${distance.toFixed(2)} meters`,

                requiredDistance:
                    "15 meters or less"
            });
        }

        // =====================================================
        // 11. GPS accuracy must be good enough
        // =====================================================

        if (
            accuracy !== undefined &&
            accuracy > 15
        ) {
            return res.status(400).json({
                message:
                    "GPS accuracy is insufficient for a 15 meter check-in",

                accuracy:
                    `${accuracy} meters`,

                requiredAccuracy:
                    "15 meters or less"
            });
        }

        // =====================================================
        // 12. Atomic protection against duplicate check-in
        // =====================================================

        const updatedBooking =
            await Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    status: "accepted"
                },
                {
                    $set: {
                        status: "ACTIVE",
                        checkInTime: new Date(),
                        checkInLatitude:
                            driverLatitude,
                        checkInLongitude:
                            driverLongitude,
                        checkInDistance:
                            distance
                    }
                },
                {
                    new: true
                }
            );

        // Another request may have checked in
        // at exactly the same time.
        if (!updatedBooking) {
            const latestBooking =
                await Booking.findById(
                    booking._id
                );

            if (
                latestBooking &&
                latestBooking.status === "ACTIVE"
            ) {
                return res.status(409).json({
                    message:
                        "Booking was already checked in",
                    status:
                        latestBooking.status,
                    checkInTime:
                        latestBooking.checkInTime
                });
            }

            return res.status(409).json({
                message:
                    "Booking could not be checked in"
            });
        }

        // =====================================================
        // 13. Successful automatic check-in
        // =====================================================

        return res.json({
            message:
                "Auto Check-In Successful",

            distance:
                `${distance.toFixed(2)} meters`,

            accuracy:
                accuracy !== undefined
                    ? `${accuracy} meters`
                    : "Not provided",

            status:
                updatedBooking.status,

            checkInTime:
                updatedBooking.checkInTime,

            booking:
                updatedBooking
        });

    } catch (error) {

        console.error(
            "AUTO CHECK-IN ERROR:",
            error
        );

        return res.status(500).json({
            message:
                error.message
        });
    }
};