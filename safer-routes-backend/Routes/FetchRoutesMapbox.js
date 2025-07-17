import express from "express";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const SafeRouter = express.Router();
const OSM_API_KEY = process.env.OSM_API_KEY; // OpenRouteService API Key
const GEO_API_KEY = process.env.GEO_API_KEY; // Geocoding API Key (e.g., Mapbox, OpenCage)
const SAFE_ROUTE_THRESHOLD = process.env.SCORE;


console.log("OpenRouteService API Key:", OSM_API_KEY);
console.log("Geocoding API Key:", GEO_API_KEY);

// Helper function to geocode a location name to coordinates
const geocodeLocation = async (location) => {
    try {
        const response = await axios.get("https://api.opencagedata.com/geocode/v1/json", {
            params: {
                q: location,
                key: GEO_API_KEY,
            },
        });

        const { results } = response.data;
        if (results.length === 0) {
            throw new Error("Location not found");
        }

        const { lat, lng } = results[0].geometry;
        return `${lng},${lat}`; // Return in longitude,latitude format
    } catch (error) {
        console.error(`Error geocoding location "${location}":`, error.message);
        throw new Error("Failed to geocode location");
    }
};


const filterRoute = async (coordinates) => {
    let safeRoute = [];


    // Split the coordinates into latitude and longitude
    const [lng, lat] = coordinates.split(',').map(parseFloat);

    // Get population density
    const popudensity = await getPopudensity(lat, lng);

    // Calculate the safety score
    const score = calculateScore(0, popudensity, 0); // Assuming crimeRate and roaddensity are not used yet

    if (score >= SAFE_ROUTE_THRESHOLD) {
        safeRoute.push({
            coordinates: coordinates,
            distance: 0, // Placeholder, update with actual distance if available
            duration: 0, // Placeholder, update with actual duration if available
            roadType: "unknown", // Placeholder, update with actual road type if available
        });
    }

    return safeRoute.length ? safeRoute : null;
};

const getCrimeRate = (coordinates)=>{}


const getPopudensity = async (latitude, longitude) => {
    try {
        // Try WorldPop API
        const response = await axios.get("https://www.worldpop.org/rest/data/pop/wpgp", {
            params: {
                iso3: "IND",
                year: 2024,
            },
        });

        const populationData = response.data;
        return populationData;
    } catch (error) {
        console.error("WorldPop API failed, trying GeoNames API...");

        try {
            // Fallback to GeoNames API
            const geonamesResponse = await axios.get("http://api.geonames.org/findNearbyPlaceNameJSON", {
                params: {
                    lat: latitude,
                    lng: longitude,
                    username: "your_geonames_username", // Replace with your GeoNames username
                },
            });

            const populationData = geonamesResponse.data.geonames[0]?.population;
            return populationData || 0; // Return 0 if population data is not available
        } catch (error) {
            console.error("GeoNames API failed:", error.message);
            return 0; // Return a default value if both APIs fail
        }
    }
};


const getRoadCondition = (coordinates)=>{}
const calculateScore = (crimeRate, popudensity, roaddensity)=>{

}



const getRouteCar = async (req, res) => {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required." });
    }

    try {
        // Geocode both origin and destination to coordinates
        const originCoordinates = await geocodeLocation(origin);
        const destinationCoordinates = await geocodeLocation(destination);

        console.log("Origin Coordinates:", originCoordinates);
        console.log("Destination Coordinates:", destinationCoordinates);

        // Fetch the route from OpenRouteService
        const response = await axios.get("https://api.openrouteservice.org/v2/directions/driving-car", {
            headers: {
                Authorization: OSM_API_KEY,
            },
            params: {
                start: originCoordinates,
                end: destinationCoordinates,
            },
        });

        const routes = response.data.features;

        if (!routes || !routes.length) {
            return res.status(404).json({ error: "No routes found." });
        }

        const routeCoordinates = routes[0]?.geometry?.coordinates;

        if (!routeCoordinates) {
            return res.status(404).json({ error: "Route geometry is missing." });
        }

        const segments = routes[0]?.properties?.segments;

        if (!segments || !segments.length) {
            return res.status(404).json({ error: "No segments found in the route." });
        }

        // Filter the route based on safety
        const safeRoutes = await filterRoute(originCoordinates); // Pass originCoordinates for testing
        if (!safeRoutes) {
            console.log("No safe routes found.");
            return res.status(404).json({ error: "No safe routes found." });
        }

        const distance = segments[0].distance / 1000; // Convert to kilometers
        const duration = segments[0].duration;
        const HR = duration / 3600;
        const MIN = duration / 60;

        return res.status(200).json({
            Distance: `${Math.round(distance)} km`,
            Duration: `${Math.round(HR)} hr, ${Math.round(MIN)} min`,
            route: routeCoordinates,
            SafeRoutes: safeRoutes,
        });
    } catch (error) {
        console.error("Error fetching routes:", error.response?.data || error.message);
        return res.status(500).json({
            error: error.response?.data?.error?.message || "Failed to fetch route.",
        });
    }
};





const getRouteBike = async (req, res) => {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required." });
    }

    try {
        // Geocode both origin and destination to coordinates
        const originCoordinates = await geocodeLocation(origin);
        const destinationCoordinates = await geocodeLocation(destination);

        const response = await axios.get("https://api.openrouteservice.org/v2/directions/cycling-regular", {
            headers: {
                Authorization: OSM_API_KEY,
            },
            params: {
                start: originCoordinates,
                end: destinationCoordinates,
            },
        });

        
        const routes = response.data.features;

        if (!routes || !routes.length) {
            return res.status(404).json({ error: "No routes found." });
        }

        const routeCoordinates = routes[0]?.geometry?.coordinates;
        
        if (!routeCoordinates) {
            return res.status(404).json({ error: "Route geometry is missing." });
        }

        const segments = routes[0]?.properties?.segments;

if (!segments || !segments.length) {
    return res.status(404).json({ error: "No segments found in the route." });
}

const safeRoutes = await filterRoute(routeCoordinates, segments);
if(!safeRoutes)
{
    console.log("No safe Routes..");
    res.send("No safe Routes...");
}




const distance = await  segments[0].distance/1000; // Accessing distance from the first segment

const duration = await segments[0].duration;

const HR = duration/3600;
const MIN = duration/60;



if (distance === undefined) {
   return res.status(404).json({ error: "Distance data is missing." });
}

console.log(routes);
return res.status(200).json({ Distance : `${Math.round(distance)} km`, Duration : `${Math.round(HR)} hr, ${Math.round(MIN)} min`, route : routeCoordinates, SafeRoutes : safeRoutes});
        
    } catch (error) {
        console.error("Error fetching routes:", error.response?.data || error.message);
        return res.status(500).json({
            error: error.response?.data?.error?.message || "Failed to fetch route.",
        });
    }
};


const getRouteWalk = async (req, res) => {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required." });
    }

    try {
        // Geocode both origin and destination to coordinates
        const originCoordinates = await geocodeLocation(origin);
        const destinationCoordinates = await geocodeLocation(destination);

        const response = await axios.get("https://api.openrouteservice.org/v2/directions/foot-walking", {
            headers: {
                Authorization: OSM_API_KEY,
            },
            params: {
                start: originCoordinates,
                end: destinationCoordinates,
            },
        });

        
        const routes = response.data.features;

        if (!routes || !routes.length) {
            return res.status(404).json({ error: "No routes found." });
        }

        const routeCoordinates = routes[0]?.geometry?.coordinates;
        
        if (!routeCoordinates) {
            return res.status(404).json({ error: "Route geometry is missing." });
        }

        const segments = routes[0]?.properties?.segments;

if (!segments || !segments.length) {
    return res.status(404).json({ error: "No segments found in the route." });
}

const safeRoutes = await filterRoute(routeCoordinates, segments);
if(!safeRoutes)
{
    console.log("No safe Routes..");
    res.send("No safe Routes...");
}




const distance = await  segments[0].distance/1000; // Accessing distance from the first segment

const duration = await segments[0].duration;

const HR = duration/3600;
const MIN = duration/60;



if (distance === undefined) {
   return res.status(404).json({ error: "Distance data is missing." });
}

console.log(routes);
return res.status(200).json({ Distance : `${Math.round(distance)} km`, Duration : `${Math.round(HR)} hr, ${Math.round(MIN)} min`, route : routeCoordinates, SafeRoutes : safeRoutes});
        
    } catch (error) {
        console.error("Error fetching routes:", error.response?.data || error.message);
        return res.status(500).json({
            error: error.response?.data?.error?.message || "Failed to fetch route.",
        });
    }
};


// Define the route
SafeRouter.post("/carRoute", getRouteCar);
SafeRouter.post("/bikeRoute", getRouteBike);
SafeRouter.post("/walkRoute", getRouteWalk);
export default SafeRouter;