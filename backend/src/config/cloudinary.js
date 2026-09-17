const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const apiKey = process.env.CLOUDINARY_API_KEY || '';
const apiSecret = process.env.CLOUDINARY_API_SECRET || '';

const isConfigured = Boolean(
  cloudName && 
  apiKey && 
  apiSecret && 
  cloudName.trim() !== '' &&
  apiKey.trim() !== '' &&
  apiSecret.trim() !== ''
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: cloudName.trim(),
    api_key: apiKey.trim(),
    api_secret: apiSecret.trim(),
    secure: true
  });
  console.log('✓ [Cloudinary] Initialized with Cloud Name:', cloudName);
} else {
  console.warn('⚠️ [Cloudinary] Credentials not fully configured in .env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Operating in local fallback storage mode.');
}

module.exports = {
  cloudinary,
  isConfigured
};
