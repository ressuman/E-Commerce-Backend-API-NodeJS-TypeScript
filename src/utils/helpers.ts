// src/utils/helpers.ts
import { randomBytes } from "crypto";

/**
 * Generates a unique SKU for a product
 * Format: CATEGORY-PREFIX-RANDOMSTRING
 *
 * @param productName - The name of the product
 * @param categoryId - The category ID
 * @returns A unique SKU string
 */
export const generateSKU = (
  productName: string,
  categoryId: string
): string => {
  // Extract first 3 chars of category ID
  const categoryPrefix = categoryId
    ? categoryId.substring(0, 3).toUpperCase()
    : "GEN";

  // Extract first 3 chars of product name
  const namePrefix = productName
    .replace(/[^a-zA-Z0-9]/g, "") // Remove non-alphanumeric chars
    .substring(0, 3)
    .toUpperCase();

  // Generate random string (6 chars)
  const randomString = randomBytes(3).toString("hex").toUpperCase();

  return `${categoryPrefix}-${namePrefix}-${randomString}`;
};
