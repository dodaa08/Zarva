import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Loader2, Clock, Route, AlertCircle } from "lucide-react";
import axios from "axios";

// Google Maps type declarations
declare global {
  interface Window {
    google: any;
  }
}

interface GoogleMaps {
  Map: any;
  Polyline: any;
  LatLng: any;
}
// https://github.com/dodaa08/Zarva.git
const loadGoogleMapsScript = (callback: () => void) => {
  // Check if Google Maps is already loaded
  if (window.google && window.google.maps) {
    callback();
    return;
  }

  const existingScript = document.getElementById("googleMaps");
  if (!existingScript) {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDjhuWZztdK2U2wWaGAyvgS5DxTCqi8kmg&libraries=places&loading=async`;
    script.id = "googleMaps";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    
    script.onload = () => {
      // Wait a bit for Google Maps to be fully initialized
      setTimeout(() => {
        if (window.google && window.google.maps) {
          callback();
        } else {
          console.error("Google Maps failed to load properly");
        }
      }, 100);
    };
    
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
    };
  } else {
    // Script exists, wait for it to load
    const checkLoaded = () => {
      if (window.google && window.google.maps) {
        callback();
      } else {
        setTimeout(checkLoaded, 100);
      }
    };
    checkLoaded();
  }
};

interface RouteData {
  route: [number, number][];
  Duration: string;
  Distance: string;
}

function SaferLocation() {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [routePath, setRoutePath] = useState<any>(null);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isWakingAPI, setIsWakingAPI] = useState(false);
  const [currentLocationMarker, setCurrentLocationMarker] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Initialize Google Maps
  useEffect(() => {
    const initializeMap = () => {
      // Double check that Google Maps is available
      if (!window.google || !window.google.maps) {
        console.error("Google Maps API not available");
        setError("Failed to load Google Maps. Please refresh the page.");
        return;
      }

      if (!mapRef.current) {
        console.error("Map container not available");
        return;
      }

      try {
        const { Map } = window.google.maps;
        const map = new Map(mapRef.current, {
          center: { lat: 28.6139, lng: 77.2090 },
          zoom: 12,
          mapTypeId: "roadmap",
          styles: [
            {
              "featureType": "all",
              "elementType": "geometry.fill",
              "stylers": [{"weight": "2.00"}]
            },
            {
              "featureType": "all",
              "elementType": "geometry.stroke",
              "stylers": [{"color": "#9c9c9c"}]
            },
            {
              "featureType": "all",
              "elementType": "labels.text",
              "stylers": [{"visibility": "on"}]
            },
            {
              "featureType": "landscape",
              "elementType": "all",
              "stylers": [{"color": "#f2f2f2"}]
            },
            {
              "featureType": "landscape",
              "elementType": "geometry.fill",
              "stylers": [{"color": "#ffffff"}]
            },
            {
              "featureType": "landscape.man_made",
              "elementType": "geometry.fill",
              "stylers": [{"color": "#ffffff"}]
            },
            {
              "featureType": "poi",
              "elementType": "all",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "road",
              "elementType": "all",
              "stylers": [{"saturation": -100}, {"lightness": 45}]
            },
            {
              "featureType": "road",
              "elementType": "geometry.fill",
              "stylers": [{"color": "#eeeeee"}]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#7b7b7b"}]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.stroke",
              "stylers": [{"color": "#ffffff"}]
            },
            {
              "featureType": "road.highway",
              "elementType": "all",
              "stylers": [{"visibility": "simplified"}]
            },
            {
              "featureType": "road.arterial",
              "elementType": "labels.icon",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "transit",
              "elementType": "all",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "water",
              "elementType": "all",
              "stylers": [{"color": "#46bcec"}, {"visibility": "on"}]
            },
            {
              "featureType": "water",
              "elementType": "geometry.fill",
              "stylers": [{"color": "#c8d7d4"}]
            },
            {
              "featureType": "water",
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#070707"}]
            },
            {
              "featureType": "water",
              "elementType": "labels.text.stroke",
              "stylers": [{"color": "#ffffff"}]
            }
          ]
        });
        setMapInstance(map);
        setIsMapLoaded(true);
        setError(null);
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Failed to initialize map. Please refresh the page.");
      }
    };

    loadGoogleMapsScript(() => {
      initializeMap();
    });
  }, []);

  // Live GPS Tracking
  const toggleLiveTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setError(null);
      // Remove current location marker and accuracy circle
      if (currentLocationMarker) {
        if (currentLocationMarker.marker) {
          currentLocationMarker.marker.setMap(null);
        }
        if (currentLocationMarker.accuracyCircle) {
          currentLocationMarker.accuracyCircle.setMap(null);
        }
        setCurrentLocationMarker(null);
      }
    } else {
      // Enhanced geolocation options for better accuracy
      const geoOptions = {
        enableHighAccuracy: true,    // Use GPS if available
        timeout: 15000,              // Increased timeout for better accuracy
        maximumAge: 0                // Always get fresh location, don't use cache
      };

      // First, get the current position immediately with enhanced accuracy
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const locationString = `${latitude},${longitude}`;
          
          // Debug information
          console.log("=== GPS LOCATION DEBUG ===");
          console.log("Latitude:", latitude);
          console.log("Longitude:", longitude);
          console.log("Accuracy:", accuracy, "meters");
          console.log("Timestamp:", new Date(position.timestamp));
          
          // Show accuracy warning if location is not very accurate
          if (accuracy > 100) {
            setError(`Location accuracy is ${Math.round(accuracy)}m. For better accuracy, ensure GPS is enabled and you're outdoors with clear sky view.`);
          } else {
            setError(null);
          }
          
          setPickup(locationString);
          
          if (mapInstance) {
            const newCenter = new window.google.maps.LatLng(latitude, longitude);
            mapInstance.setCenter(newCenter);
            mapInstance.setZoom(18); // Higher zoom for better precision
            
            // Remove existing current location marker
            if (currentLocationMarker) {
              currentLocationMarker.setMap(null);
            }
            
            // Add a blue dot marker for current location with accuracy circle
            const marker = new window.google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstance,
              title: `Your Current Location (±${Math.round(accuracy)}m accuracy)`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              },
              zIndex: 1000
            });
            
            // Add accuracy circle
            const accuracyCircle = new window.google.maps.Circle({
              strokeColor: '#4285F4',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#4285F4',
              fillOpacity: 0.15,
              map: mapInstance,
              center: { lat: latitude, lng: longitude },
              radius: accuracy // accuracy in meters
            });
            
            setCurrentLocationMarker({ marker, accuracyCircle });
          }
          
          console.log("Current location updated:", latitude, longitude);
        },
        (error) => {
          console.error("Error getting current location:", error);
          let errorMessage = "Error getting location: ";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += "Location access denied. Please enable location permissions in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += "Location information unavailable. Try moving to an area with better GPS signal.";
              break;
            case error.TIMEOUT:
              errorMessage += "Location request timed out. Please try again or move to an area with better GPS signal.";
              break;
            default:
              errorMessage += "Unknown error occurred. Please check your location settings.";
              break;
          }
          setError(errorMessage);
        },
        geoOptions
      );

      // Then set up continuous tracking with the same enhanced options
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const locationString = `${latitude},${longitude}`;
          
          console.log("=== GPS UPDATE ===");
          console.log("New location:", latitude, longitude);
          console.log("Accuracy:", accuracy, "meters");
          console.log("Time:", new Date(position.timestamp));
          
          setPickup(locationString);
          
          if (mapInstance && currentLocationMarker) {
            const newPosition = { lat: latitude, lng: longitude };
            
            // Update marker position
            if (currentLocationMarker.marker) {
              currentLocationMarker.marker.setPosition(newPosition);
              currentLocationMarker.marker.setTitle(`Your Current Location (±${Math.round(accuracy)}m accuracy)`);
            }
            
            // Update accuracy circle
            if (currentLocationMarker.accuracyCircle) {
              currentLocationMarker.accuracyCircle.setCenter(newPosition);
              currentLocationMarker.accuracyCircle.setRadius(accuracy);
            }
            
            // Only recenter if accuracy is good (less than 50m) to avoid jumping around
            if (accuracy < 50) {
              mapInstance.setCenter(newPosition);
            }
          }
        },
        (error) => {
          console.error("Error tracking location:", error);
          setError("Error tracking location: " + error.message + ". Try moving to an area with better GPS signal.");
        },
        geoOptions
      );
      setWatchId(id);
    }
  };

  // Test API connection
  const testApiConnection = async () => {
    try {
      console.log("Testing API connection...");
      const response = await axios.get("http://localhost:3000/", {
        timeout: 5000
      });
      console.log("API connection test successful:", response.status);
      return true;
    } catch (error) {
      console.error("API connection test failed:", error);
      return false;
    }
  };

  // Wake up API (for local development)
  const wakeUpAPI = async () => {
    setIsWakingAPI(true);
    setError(null);
    
    try {
      console.log("Testing local API service...");
      await axios.get("http://localhost:3000/", {
        timeout: 10000
      });
      setError(null);
      console.log("Local API service is working!");
    } catch (error) {
      console.error("Failed to connect to local API:", error);
      setError("Failed to connect to the local API service. Make sure the backend server is running on port 3000.");
    } finally {
      setIsWakingAPI(false);
    }
  };

  // Fetch safer routes
  const fetchSaferRoute = async () => {
    if (!pickup || !destination) {
      setError("Please enter both pickup location and destination.");
      return;
    }

    setIsLoadingRoute(true);
    setError(null);

    try {
      console.log("=== ROUTE FETCH DEBUG ===");
      console.log("Pickup:", pickup);
      console.log("Destination:", destination);
      
      // Test API connection first
      console.log("Testing API connection...");
      const isApiWorking = await testApiConnection();
      if (!isApiWorking) {
        setError("Local API server is not responding. Make sure the backend server is running on port 3000.");
        return;
      }
      console.log("API connection successful!");
      
      console.log("Making route request...");
      const response = await axios.post<RouteData>(
        "http://localhost:3000/v1/api/carRoute", 
        {
          origin: pickup,
          destination: destination,
        },
        {
          timeout: 10000, // Local server should be fast
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      console.log("Response status:", response.status);
      console.log("Response data:", response.data);

      const data = response.data;

      // Check if response has the expected structure
      if (!data) {
        throw new Error("No data received from server");
      }

      // Handle different response formats
      let routeCoordinates: Array<{lat: number, lng: number}> = [];
      let duration = "Unknown";
      let distance = "Unknown";

      if (data.route && Array.isArray(data.route)) {
        console.log("Processing route coordinates...");
        routeCoordinates = data.route.map(([lng, lat]) => {
          console.log("Coordinate:", lng, lat);
          return { lat: Number(lat), lng: Number(lng) };
        });
        console.log("Processed coordinates:", routeCoordinates.length, "points");
      } else {
        console.error("Invalid route data structure:", data);
        throw new Error("Invalid route data structure received from server");
      }

      if (data.Duration) duration = data.Duration;
      if (data.Distance) distance = data.Distance;

      if (routeCoordinates.length === 0) {
        throw new Error("No route coordinates received from server");
      }

      console.log("Setting route info...");
      setRouteInfo({
        duration: duration,
        distance: distance,
      });

      // Clear existing route
      if (routePath) {
        console.log("Clearing existing route...");
        routePath.setMap(null);
      }

      if (mapInstance && routeCoordinates.length > 0) {
        console.log("Drawing new route on map...");
        
        const newRoutePath = new window.google.maps.Polyline({
          path: routeCoordinates,
          geodesic: true,
          strokeColor: "#3B82F6",
          strokeOpacity: 0.8,
          strokeWeight: 5,
        });

        newRoutePath.setMap(mapInstance);
        setRoutePath(newRoutePath);
        
        // Fit the map to show the entire route
        console.log("Fitting map bounds...");
        const bounds = new window.google.maps.LatLngBounds();
        routeCoordinates.forEach(coord => bounds.extend(coord));
        mapInstance.fitBounds(bounds);
        
        // Add markers for start and end points
        console.log("Adding start/end markers...");
        new window.google.maps.Marker({
          position: routeCoordinates[0],
          map: mapInstance,
          title: "Start: " + pickup,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8,%3csvg width='32' height='32' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='%2310B981'/%3e%3ccircle cx='12' cy='9' r='2.5' fill='white'/%3e%3c/svg%3e",
            scaledSize: new window.google.maps.Size(32, 32),
          },
          zIndex: 999
        });

        new window.google.maps.Marker({
          position: routeCoordinates[routeCoordinates.length - 1],
          map: mapInstance,
          title: "Destination: " + destination,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8,%3csvg width='32' height='32' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='%23EF4444'/%3e%3ccircle cx='12' cy='9' r='2.5' fill='white'/%3e%3c/svg%3e",
            scaledSize: new window.google.maps.Size(32, 32),
          },
          zIndex: 999
        });
        
        console.log("Route successfully drawn on map!");
        setError(null);
      }
    } catch (err) {
      console.error("=== ROUTE FETCH ERROR ===");
      console.error("Error details:", err);
      
      let errorMessage = "Failed to fetch route. ";
      
      if (axios.isAxiosError(err)) {
        console.error("Axios error response:", err.response?.data);
        console.error("Axios error status:", err.response?.status);
        
        if (err.code === 'ECONNABORTED') {
          errorMessage += "Request timed out. The service might be starting up - please try again in 30-60 seconds.";
        } else if (err.response?.status === 404) {
          errorMessage += "Route service endpoint not found. Please contact support.";
        } else if (err.response && err.response.status >= 500) {
          errorMessage += "Server error. Please try again later.";
        } else if (err.message.includes('Network Error')) {
          errorMessage += "Network error. The service might be sleeping - please try again in a moment.";
        } else if (err.response?.data?.error) {
          errorMessage += err.response.data.error;
        } else {
          errorMessage += err.message || "Unknown network error occurred.";
        }
      } else {
        errorMessage += err instanceof Error ? err.message : "Unknown error occurred.";
      }
      
      console.error("Final error message:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Smart Route Planning
          </h1>
         
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex items-center mb-6">
                <div className="bg-blue-100 p-3 rounded-full mr-4">
                  <Route className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">Route Planner</h2>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Route Info Display */}
              {routeInfo && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <h3 className="text-sm font-medium text-green-800 mb-3">Route Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-green-600 mr-2" />
                      <div>
                        <p className="text-xs text-green-600">Distance</p>
                        <p className="text-sm font-semibold text-green-800">{routeInfo.distance}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-green-600 mr-2" />
                      <div>
                        <p className="text-xs text-green-600">Duration</p>
                        <p className="text-sm font-semibold text-green-800">{routeInfo.duration}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Tracking Button */}
              <button
                onClick={toggleLiveTracking}
                className={`w-full mb-6 px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center ${
                  watchId
                    ? "bg-red-100 text-red-700 border border-red-200 hover:bg-red-200"
                    : "bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200"
                } ${!isMapLoaded ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!isMapLoaded}
              >
                <Navigation className={`h-5 w-5 mr-2 ${watchId ? "animate-pulse" : ""}`} />
                {watchId ? "Stop Live Tracking" : "Start Live Tracking"}
              </button>

              {/* Input Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pickup Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="Enter pickup location"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="Enter destination"
                    />
                  </div>
                </div>
              </div>

              {/* Find Route Button */}
              <button
                onClick={fetchSaferRoute}
                className={`w-full mt-6 px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center ${
                  !pickup || !destination || !isMapLoaded || isLoadingRoute
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 shadow-lg hover:shadow-xl"
                }`}
                disabled={!pickup || !destination || !isMapLoaded || isLoadingRoute}
              >
                {isLoadingRoute ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Finding Route...
                  </>
                ) : (
                  <>
                    <Route className="h-5 w-5 mr-2" />
                    Find Safest Route
                  </>
                )}
              </button>

              {/* Wake Up API Button */}
              <button
                onClick={wakeUpAPI}
                className="w-full mt-3 px-4 py-3 rounded-xl font-medium text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200 transition-all duration-200 flex items-center justify-center"
                disabled={isWakingAPI}
              >
                {isWakingAPI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing connection...
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Test Local API Connection
                  </>
                )}
              </button>

              {/* Service Info */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Local Development:</strong> Make sure your backend server is running on port 3000. Run "node index.js" in the safer-routes-backend/safer-routes-api directory.
                </p>
              </div>

              {/* Loading Map Indicator */}
              {!isMapLoaded && (
                <div className="mt-4 flex items-center justify-center text-amber-600">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="text-sm">Initializing map...</span>
                </div>
              )}
            </div>

            {/* Additional Info Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Features</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-600">Real-time traffic analysis</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-600">Crime data integration</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-600">Well-lit route prioritization</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-600">Emergency services proximity</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">📍 GPS Accuracy Tips</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div>• Enable high accuracy location in browser settings</div>
                  <div>• Move outdoors for better GPS signal</div>
                  <div>• Allow location permissions when prompted</div>
                  <div>• Wait a few seconds for GPS to stabilize</div>
                  <div>• Clear sky view improves accuracy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="relative h-[600px] lg:h-[700px]">
                {!isMapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Interactive Map</h3>
                      <p className="text-gray-500">Please wait while we prepare your mapping experience...</p>
                    </div>
                  </div>
                )}
                <div ref={mapRef} className="w-full h-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SaferLocation;
