import { v2 as cloudinary, ConfigOptions } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

type CloudinaryConfig = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

type MaybeString = string | undefined;

class CloudinaryConfigError extends Error {
  constructor(missingKeys: string[]) {
    super(`Missing Cloudinary configuration: ${missingKeys.join(", ")}`);
    this.name = "CloudinaryConfigError";
  }
}

const requiredCloudinaryKeys: (keyof CloudinaryConfig)[] = [
  "cloud_name",
  "api_key",
  "api_secret",
];

function hasRequiredKeys(
  config: Partial<CloudinaryConfig>
): config is CloudinaryConfig {
  return requiredCloudinaryKeys.every((key) => config[key] !== undefined);
}

export const initializeCloudinary = (): typeof cloudinary => {
  const config: Partial<CloudinaryConfig> = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };

  if (!hasRequiredKeys(config)) {
    const missingKeys = requiredCloudinaryKeys.filter((key) => !config[key]);
    throw new CloudinaryConfigError(missingKeys);
  }

  const frozenConfig = Object.freeze({ ...config });
  cloudinary.config(frozenConfig);

  return cloudinary;
};

export default initializeCloudinary();

// // For Cloudinary
// import cloudinary from './utils/cloudinary';

// export const uploadImage = async (file: string) => {
//   return cloudinary.uploader.upload(file, {
//     folder: 'uploads',
//     resource_type: 'auto',
//   });
// };
