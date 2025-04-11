// Packages
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import http from "node:http";
import compression from "compression";
import rateLimit from "express-rate-limit";

// Utilities
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import connectDB from "@/config/db.js";
import authRoutes from "@/routes/authenticationRoutes.js";
import userRoutes from "@/routes/userRoutes.js";
import categoryRoutes from "@/routes/categoryRoutes.js";
import productRoutes from "@/routes/productRoutes.js";
import orderRoutes from "@/routes/orderRoutes.js";

// Database Connection
connectDB();

dotenv.config();
const port = process.env.PORT_NUMBER || 4200;

const app = express();

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
); // Configure CORS
app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(compression());
app.use(cookieParser());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/orders", orderRoutes);

app.get("*", (req, res, next) => {
  res.set("Cache-Control", "public, max-age=300");
  next();
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
server.listen(port, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port: ${port}, and listening to requests at http://localhost:${port}`
  );
});

export default server;
