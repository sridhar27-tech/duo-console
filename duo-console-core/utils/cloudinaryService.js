// services/cloudinaryService.js
const cloudinary = require('cloudinary').v2;

// Ensure Cloudinary is configured with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file stream/buffer to Cloudinary with an auto-purge tag.
 */
const uploadTransientMedia = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'duo-console-temp',
        tags: ['auto-purge-24h'], // Identifies media subject to 24h retention
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Queries Cloudinary for images tagged 'auto-purge-24h' older than 24 hours
 * and batch deletes them.
 */
const purgeExpiredMedia = async () => {
  console.log('[Maintenance] Checking Cloudinary for expired transient images...');

  try {
    const response = await cloudinary.api.resources_by_tag('auto-purge-24h', {
      max_results: 100,
    });

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const expiredPublicIds = response.resources
      .filter((asset) => {
        const createdAt = new Date(asset.created_at).getTime();
        return now - createdAt > TWENTY_FOUR_HOURS;
      })
      .map((asset) => asset.public_id);

    if (expiredPublicIds.length > 0) {
      await cloudinary.api.delete_resources(expiredPublicIds);
      console.log(`[Maintenance] Successfully deleted ${expiredPublicIds.length} expired image(s).`);
    } else {
      console.log('[Maintenance] No expired images found.');
    }
  } catch (error) {
    console.error('[Maintenance] Error during Cloudinary auto-cleanup:', error.message);
  }
};

module.exports = {
  uploadTransientMedia,
  purgeExpiredMedia,
};