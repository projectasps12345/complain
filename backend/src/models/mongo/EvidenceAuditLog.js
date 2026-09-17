const mongoose = require('mongoose');

const evidenceAuditLogSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  complaint_id: { type: Number, required: true, index: true },
  evidence_id: { type: Number, default: null, index: true },
  cloudinary_public_id: { type: String, default: null },
  action: { 
    type: String, 
    enum: ['UPLOAD', 'VIEW', 'DELETE', 'REPLACE', 'ANALYZE'], 
    required: true, 
    index: true 
  },
  user_id: { type: Number, required: true, index: true },
  user_role: { type: String, default: 'citizen' },
  user_name: { type: String, default: 'User' },
  ip_address: { type: String, default: '127.0.0.1' },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('EvidenceAuditLog', evidenceAuditLogSchema);
