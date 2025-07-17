import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Loader2, Clock, Route, AlertCircle, Car, Shield, Eye, Phone } from "lucide-react";
import axios from "axios";

// Google Maps type declarations
declare global {
  interface Window {
    google: any;
    lastMapCenter: number; // Added for simplified map centering
    lastAddressUpdate: number; // Added for address update throttling
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
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key not found in environment variables");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async`;
    script.id = "googleMaps";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script); // Use head instead of body for faster loading
    
    script.onload = () => {
      // Immediate callback, no delay
      if (window.google && window.google.maps) {
        callback();
      } else {
        console.error("Google Maps failed to load properly");
      }
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
        setTimeout(checkLoaded, 50); // Faster checking
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
          // Simplified styles for faster loading
          styles: [
            {
              "featureType": "poi",
              "elementType": "all",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "transit",
              "elementType": "all",
              "stylers": [{"visibility": "off"}]
            }
          ],
          // Performance optimizations
          gestureHandling: 'cooperative',
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false
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

  // Convert coordinates to readable address
  const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    return new Promise((resolve) => {
      if (!window.google || !window.google.maps) {
        resolve(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat, lng } },
        (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            // Get a short, readable address
            const address = results[0].formatted_address;
            const shortAddress = address.split(',').slice(0, 2).join(', ');
            resolve(shortAddress);
          } else {
            resolve(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        }
      );
    });
  };

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
        enableHighAccuracy: true,
        timeout: 15000, // Longer timeout to avoid timeout errors
        maximumAge: 10000 // Allow some cached data for speed
      };

      // First, get the current position immediately
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          console.log("Initial GPS:", latitude, longitude, "±" + Math.round(accuracy) + "m");
          
          // Convert coordinates to readable address
          const address = await getAddressFromCoords(latitude, longitude);
          setPickup(address);
          
          console.log("Address:", address);
          
          // Simple accuracy feedback
          if (accuracy > 100) {
            setError(`Location accuracy: ${Math.round(accuracy)}m. Try moving outdoors for better accuracy.`);
          } else {
            setError(null);
          }
          
          if (mapInstance) {
            const newCenter = new window.google.maps.LatLng(latitude, longitude);
            mapInstance.setCenter(newCenter);
            mapInstance.setZoom(16); // Fixed zoom level for consistency
            
            // Remove existing current location marker
            if (currentLocationMarker) {
              if (currentLocationMarker.marker) {
                currentLocationMarker.marker.setMap(null);
              }
              if (currentLocationMarker.accuracyCircle) {
                currentLocationMarker.accuracyCircle.setMap(null);
              }
            }
            
            // Simple blue dot marker
            const marker = new window.google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstance,
              title: `Your Location: ${address} (±${Math.round(accuracy)}m)`,
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
            
            // Simple accuracy circle (smaller for performance)
            const accuracyCircle = new window.google.maps.Circle({
              strokeColor: '#4285F4',
              strokeOpacity: 0.5,
              strokeWeight: 1,
              fillColor: '#4285F4',
              fillOpacity: 0.1,
              map: mapInstance,
              center: { lat: latitude, lng: longitude },
              radius: accuracy
            });
            
            setCurrentLocationMarker({ marker, accuracyCircle });
          }
          
          console.log("Location tracking started");
        },
        (error) => {
          console.error("GPS Error:", error.message);
          let errorMessage = "Location error: ";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += "Please enable location permissions in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += "GPS signal unavailable. Try moving outdoors or near a window.";
              break;
            case error.TIMEOUT:
              errorMessage += "GPS is taking longer than expected. Please wait and try again, or ensure you're in an area with good GPS signal.";
              break;
            default:
              errorMessage += "Unknown GPS error. Please try again.";
              break;
          }
          setError(errorMessage);
        },
        geoOptions
      );

      // Then set up continuous tracking with the same options
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          console.log("GPS Update:", latitude, longitude, "±" + Math.round(accuracy) + "m");
          
          // Update address less frequently (every 10 seconds) to avoid too many API calls
          const now = Date.now();
          if (!window.lastAddressUpdate || now - window.lastAddressUpdate > 10000) {
            const address = await getAddressFromCoords(latitude, longitude);
            setPickup(address);
            window.lastAddressUpdate = now;
          }
          
          if (mapInstance && currentLocationMarker && currentLocationMarker.marker) {
            const newPosition = { lat: latitude, lng: longitude };
            
            // Simple marker position update
            currentLocationMarker.marker.setPosition(newPosition);
            
            // Update accuracy circle if it exists
            if (currentLocationMarker.accuracyCircle) {
              currentLocationMarker.accuracyCircle.setCenter(newPosition);
              currentLocationMarker.accuracyCircle.setRadius(accuracy);
            }
            
            // Only recenter map occasionally, not every update
            if (!window.lastMapCenter || now - window.lastMapCenter > 3000) { // Every 3 seconds max
              mapInstance.setCenter(newPosition);
              window.lastMapCenter = now;
            }
          }
        },
        (error) => {
          console.error("Error tracking location:", error);
          setError("GPS tracking error: " + error.message + ". Try moving to an area with better GPS signal.");
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,               // Longer timeout for continuous tracking
          maximumAge: 8000              // Allow some old data for smoother updates
        }
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Smart Route Planning
          </h1>
          <p className="text-gray-600">Find the safest routes with real-time tracking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Left Sidebar - Features */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="h-5 w-5 text-blue-500 mr-3" />
                Car Safety Features
              </h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-700">
                  <Route className="h-4 w-4 text-green-500 mr-3" />
                  Real-time traffic analysis
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Shield className="h-4 w-4 text-blue-500 mr-3" />
                  Crime data integration
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Eye className="h-4 w-4 text-purple-500 mr-3" />
                  Well-lit route priority
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Phone className="h-4 w-4 text-orange-500 mr-3" />
                  Emergency services nearby
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Navigation className="h-4 w-4 mr-2" />
                  GPS Tips
                </h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div>📍 Enable location permissions in browser</div>
                  <div>🌤️ Move outdoors for better GPS signal</div>
                  <div>⏱️ Wait 10-15 seconds for GPS to stabilize</div>
                  <div>🔋 Keep device charged for better accuracy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tracker Control Box */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Route className="h-5 w-5 text-blue-600 mr-2" />
                  Route Control
                </h2>
                {!isMapLoaded && (
                  <div className="flex items-center text-amber-600">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span className="text-sm">Loading map...</span>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Route Info Display */}
              {routeInfo && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Route Found</h3>
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

              {/* Control Buttons Row */}
              <div className="mb-6">
                {/* Live Tracking Button */}
                <button
                  onClick={toggleLiveTracking}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center ${
                    watchId
                      ? "bg-red-100 text-red-700 border border-red-200 hover:bg-red-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200"
                  } ${!isMapLoaded ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={!isMapLoaded}
                >
                  <Navigation className={`h-4 w-4 mr-2 ${watchId ? "animate-spin" : ""}`} />
                  {watchId ? "Stop GPS Tracking" : "Start GPS Tracking"}
                </button>
              </div>

              {/* Status indicator when tracking */}
              {watchId && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-sm text-blue-700 font-medium">
                      GPS tracking active - Following your movement
                    </span>
                  </div>
                </div>
              )}

              {/* Input Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                      placeholder="Enter pickup location"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                      placeholder="Enter destination"
                    />
                  </div>
                </div>
              </div>

              {/* Find Route Button */}
              <button
                onClick={fetchSaferRoute}
                className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center ${
                  !pickup || !destination || !isMapLoaded || isLoadingRoute
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
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
            </div>

            {/* Map Container */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="relative h-[500px] lg:h-[600px]">
                {!isMapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">Loading Map</h3>
                      <p className="text-gray-500 text-sm">Preparing your route planning experience...</p>
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
