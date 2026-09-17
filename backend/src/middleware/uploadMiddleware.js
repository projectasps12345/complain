const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm', '.mov'];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `evidence-${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  // Validate extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Unsupported file type: ${ext}. Allowed formats are JPG, JPEG, PNG, WEBP, MP4, WEBM, MOV.`), false);
  }

  // Validate MIME
  const isImage = ALLOWED_IMAGE_MIMES.includes(mime);
  const isVideo = ALLOWED_VIDEO_MIMES.includes(mime);

  if (!isImage && !isVideo) {
    return cb(new Error(`Unsupported MIME type: ${mime}. Allowed formats are JPEG, PNG, WebP, MP4, WebM, QuickTime.`), false);
  }

  cb(null, true);
};

// Multer instance configured up to 50MB max ceiling
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // 50MB ceiling; route/service enforces 10MB for images
    files: 5 // up to 5 evidence files at once
  },
  fileFilter: fileFilter
});

/**
 * Validates individual file constraints after multer parsing
 */
function validateUploadedFile(file) {
  if (!file) return { valid: false, error: 'No file provided.' };

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  const isImage = ALLOWED_IMAGE_MIMES.includes(mime);
  const isVideo = ALLOWED_VIDEO_MIMES.includes(mime);

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image "${file.originalname}" exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).` };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return { valid: false, error: `Video "${file.originalname}" exceeds 50 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).` };
  }

  return { valid: true, isImage, isVideo, ext, mime };
}

upload.validateUploadedFile = validateUploadedFile;
upload.ALLOWED_IMAGE_MIMES = ALLOWED_IMAGE_MIMES;
upload.ALLOWED_VIDEO_MIMES = ALLOWED_VIDEO_MIMES;

module.exports = upload;
