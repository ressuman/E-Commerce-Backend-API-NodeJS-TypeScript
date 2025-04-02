// src/config/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

type CloudinaryConfig = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

class CloudinaryConfigError extends Error {
  constructor(missingKeys: string[]) {
    super(`Missing Cloudinary configuration: ${missingKeys.join(", ")}`);
    this.name = "CloudinaryConfigError";
  }
}

const requiredKeys: (keyof CloudinaryConfig)[] = [
  "cloud_name",
  "api_key",
  "api_secret",
];

export const initializeCloudinary = (): typeof cloudinary => {
  const config = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,

    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  const missingKeys = requiredKeys.filter((key) => !config[key]);
  if (missingKeys.length) throw new CloudinaryConfigError(missingKeys);

  cloudinary.config(config);
  return cloudinary;
};

export default initializeCloudinary();
