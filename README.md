# Safer Location App

A smart route planning application that helps users find the safest routes between two locations using real-time data and advanced safety algorithms.

## Project Structure

```
safer-location-app/
├── safer-location-frontend/    # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   └── SaferLocation.tsx    # Main safer location component
│   │   ├── App.tsx                  # Root application component
│   │   └── main.tsx                 # Application entry point
│   └── package.json
├── safer-routes-backend/       # Node.js backend API
│   └── safer-routes-api/       # API service for route calculations
│       ├── index.js            # Main server file
│       ├── Routes/             # API route handlers
│       └── package.json
└── README.md
```

## Features

- **Smart Route Planning**: Find the safest routes between pickup and destination locations
- **Live GPS Tracking**: Real-time location tracking with visual indicators
- **Google Maps Integration**: Interactive map with route visualization
- **Safety Analysis**: Route recommendations based on crime data, lighting, and emergency services proximity
- **Modern UI**: Clean, responsive design with loading states and error handling

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd safer-routes-backend/safer-routes-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node index.js
   ```
   
   The backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd safer-location-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   
   The frontend will run on `http://localhost:5173`

## Usage

1. **Start Backend**: Make sure the backend server is running on port 3000
2. **Open Frontend**: Navigate to `http://localhost:5173` in your browser
3. **Enable Location**: Allow location permissions for GPS tracking
4. **Plan Route**: Enter pickup and destination locations, then click "Find Safest Route"
5. **View Results**: See the route displayed on the map with distance and duration information

## Technologies Used

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Axios** for API calls
- **Google Maps JavaScript API** for mapping

### Backend
- **Node.js** with Express
- **OpenRouteService API** for route calculation
- **Geocoding API** for location services

## API Endpoints

- `GET /` - Health check endpoint
- `POST /v1/api/carRoute` - Calculate safer route between two locations
  - Body: `{ "origin": "location1", "destination": "location2" }`
  - Response: `{ "route": [[lng, lat], ...], "Distance": "X km", "Duration": "X min" }`

## Development Notes

- The app requires a Google Maps API key configured in the SaferLocation component
- Backend uses environment variables for API keys (stored in `.env` file)
- Frontend and backend must both be running for full functionality
- The application is designed for local development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Enactus initiative for creating safer transportation solutions. 


