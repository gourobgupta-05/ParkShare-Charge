const mongoose = require("mongoose");

const SlotSchema = new mongoose.Schema({
    hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Host",
    required: true
},
    propertyType: String,

    title: String,

    address: String,

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },

        coordinates: {
            type: [Number],
            required: true
        }
    },

    pricePerHour: Number,

    chargerType: String,

    isAvailable: Boolean

}, {
    collection: "slots"
});

module.exports = mongoose.model("Slot", SlotSchema);