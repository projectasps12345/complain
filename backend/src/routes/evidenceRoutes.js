const express = require('express');
const router = express.Router();
const evidenceController = require('../controllers/evidenceController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Upload evidence files (single or multiple, up to 5)
router.post(
  '/upload',
  authMiddleware,
  upload.array('evidence', 5),
  (req, res) => evidenceController.uploadEvidence(req, res)
);

// Preview AI Visual Analysis on a draft file before complaint submission
router.post(
  '/preview-analysis',
  authMiddleware,
  upload.single('evidence'),
  (req, res) => evidenceController.previewAnalysis(req, res)
);

// Get all evidence for a complaint (with RBAC enforcement)
router.get(
  '/complaint/:complaint_id',
  authMiddleware,
  (req, res) => evidenceController.getComplaintEvidence(req, res)
);

// Delete an evidence item (from Cloudinary + DB + audit log)
router.delete(
  '/:id',
  authMiddleware,
  (req, res) => evidenceController.deleteEvidence(req, res)
);

// Trigger or re-run AI Visual Analysis for an evidence item
router.post(
  '/:id/analyze',
  authMiddleware,
  (req, res) => evidenceController.triggerAIAnalysis(req, res)
);

// View audit logs for complaint evidence (Admins / Officers)
router.get(
  '/complaint/:complaint_id/audit',
  authMiddleware,
  (req, res) => evidenceController.getAuditLogs(req, res)
);

module.exports = router;
