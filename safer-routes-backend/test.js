import axios from "axios";

const getPopulationData = async (latitude, longitude) => {
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
// Example usage
// (async () => {
//     const latitudes = [28.6273928, 28.5706333]; // Array of latitudes
//     const longitudes = [77.1716954, 77.3272147]; // Array of longitudes

//     for (let i = 0; i < latitudes.length; i++) {
//         const latitude = latitudes[i];
//         const longitude = longitudes[i];
//         const populationData = await getPopulationData(latitude, longitude);
//         console.log(`Population Data for (${latitude}, ${longitude}):`, populationData);
//     }
// })();



const getdata = async(coordinates)=>{
    const [lng, lat] = coordinates.split(',').map(parseFloat);
    const popudensity = await getPopulationData(lat, lng);

    console.log(popudensity);

}

getdata("72.8692035,19.054999");