// src/utils/generateOtp.ts
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export const OTP_EXPIRY_MINUTES = 15;

export interface OTPData {
  code: string;
  hashedCode: string;
  expiresAt: Date;
}

export async function generateOTP(): Promise<OTPData> {
  // Generate UUID-based OTP with numeric validation
  const uuid = uuidv4();
  let numericOTP = uuid.replace(/\D/g, ""); // Remove all non-digit characters

  // Ensure exactly 6 digits with zero padding if needed
  if (numericOTP.length < 6) {
    numericOTP = numericOTP.padEnd(6, "0");
  } else {
    numericOTP = numericOTP.slice(0, 6);
  }

  // Hash and expiration
  const hashedCode = await bcrypt.hash(numericOTP, 12);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  return {
    code: numericOTP,
    hashedCode,
    expiresAt,
  };
}

export function verifyOTP(
  candidateOTP: string,
  hashedOTP: string,
  expiresAt: Date
): boolean {
  const isNotExpired = new Date() < expiresAt;
  const isValid = bcrypt.compareSync(candidateOTP, hashedOTP);
  return isNotExpired && isValid;
}
