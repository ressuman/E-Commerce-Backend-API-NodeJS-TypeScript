// src/utils/db.ts
import mongoose, { Connection, Mongoose } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

type MongoConnectionEvents = "connected" | "error" | "disconnected";
enum MongoConnectionState {
  CONNECTED = "connected",
  ERROR = "error",
  DISCONNECTED = "disconnected",
}

export interface DatabaseConnection {
  connection: Connection;
  instance: Mongoose;
}

const connectionStates = new Set<MongoConnectionState>();

const handleConnectionEvent = (event: MongoConnectionEvents) => {
  const handlers: Record<MongoConnectionEvents, (...args: any[]) => void> = {
    [MongoConnectionState.CONNECTED]: () => {
      console.log("Mongoose connected to DB Cluster");
      connectionStates.add(MongoConnectionState.CONNECTED);
    },
    [MongoConnectionState.ERROR]: (error: Error) => {
      console.error("Mongoose connection error:", error);
      connectionStates.add(MongoConnectionState.ERROR);
    },
    [MongoConnectionState.DISCONNECTED]: () => {
      console.log("Mongoose disconnected");
      connectionStates.add(MongoConnectionState.DISCONNECTED);
    },
  };

  return handlers[event];
};

class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export const connectDB = async (): Promise<DatabaseConnection> => {
  const connectionEvents = Object.values(MongoConnectionState);

  connectionEvents.forEach((event) => {
    mongoose.connection.on(event, handleConnectionEvent(event));
  });

  try {
    if (!process.env.MONGO_DB_URL_BASE) {
      throw new DatabaseConnectionError(
        "MongoDB connection URL not found in environment variables"
      );
    }

    const instance = await mongoose.connect(process.env.MONGO_DB_URL_BASE);
    console.log("Successfully connected to MongoDB Database 👍");

    return {
      connection: instance.connection,
      instance,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown connection error";
    console.error("MongoDB connection error:", errorMessage);

    if (error instanceof DatabaseConnectionError) {
      process.exit(1);
    }

    throw error;
  }
};

export default connectDB;
