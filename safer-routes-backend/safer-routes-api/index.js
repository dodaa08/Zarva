import express from "express";
import dotenv from "dotenv";
import SafeRouter from "./Routes/FetchRoutes.js";
import cors from "cors";

dotenv.config();
console.log("Environment variables loaded.");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware should come first
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// JSON parsing middleware
app.use(express.json());

// Static files
app.use(express.static("public"));

// Routes
app.use("/v1/api/", SafeRouter);

// Root route
app.get("/", (req, res) => {
    res.send("Backend server is working...");
    console.log("Root endpoint accessed");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
