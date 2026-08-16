import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

const BACKEND_URL = "http://192.168.0.104:1495";

export const LOCATION_TASK_NAME = "PARKSHARE_GEOFENCE_TASK";

const BOOKING_ID = "6a810c4a39e770b7c2781a4d";

TaskManager.defineTask(
    LOCATION_TASK_NAME,
    async ({ data, error }) => {

        if (error) {
            console.log(
                "LOCATION TASK ERROR:",
                error
            );
            return;
        }

        if (!data) {
            return;
        }

        const { locations } =
            data as {
                locations: Location.LocationObject[];
            };

        if (
            !locations ||
            locations.length === 0
        ) {
            return;
        }

        const location = locations[0];

        const latitude =
            location.coords.latitude;

        const longitude =
            location.coords.longitude;

        const accuracy =
            location.coords.accuracy;

        console.log(
            "GPS:",
            latitude,
            longitude,
            "accuracy:",
            accuracy
        );

        try {

            const response = await fetch(
                `${BACKEND_URL}/api/bookings/${BOOKING_ID}/auto-checkin`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        driverLatitude:
                            latitude,

                        driverLongitude:
                            longitude,

                        accuracy:
                            accuracy
                    })
                }
            );

            const result =
                await response.json();

            console.log(
                "CHECK-IN RESPONSE:",
                result
            );

        } catch (err) {

            console.log(
                "BACKEND CONNECTION ERROR:",
                err
            );
        }
    }
);