// In your image upload route
router.post(
  "/upload",
  authenticate,
  authorize([], { canUploadImages: true }),
  handleImageUpload
);
