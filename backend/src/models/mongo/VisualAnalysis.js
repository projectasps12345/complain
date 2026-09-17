const mongoose = require('mongoose');

const visualAnalysisSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  complaint_id: { type: Number, required: true, index: true },
  complaint_evidence_id: { type: Number, required: true, index: true },
  model_name: { type: String, default: 'CivicPulse-Vision-Engine-v2' },
  model_version: { type: String, default: '2.0.0' },
  image_quality: { type: String, enum: ['GOOD', 'ACCEPTABLE', 'POOR', 'UNKNOWN'], default: 'GOOD' },
  quality_metrics: {
    blur_score: { type: Number, default: 0 },
    brightness: { type: Number, default: 0 },
    contrast: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    resolution_label: { type: String, default: 'Standard' }
  },
  detected_objects: [{
    label: { type: String, required: true },
    confidence: { type: Number, required: true },
    box: { type: [Number], default: [] }
  }],
  visual_severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  visual_risk: { type: String, default: 'Moderate' },
  evidence_consistency: { type: String, enum: ['MATCH', 'POSSIBLE MISMATCH', 'UNVERIFIED'], default: 'MATCH' },
  consistency_details: { type: String, default: '' },
  confidence: { type: Number, default: 0.9 },
  analysis_status: { type: String, enum: ['PENDING', 'ANALYZING', 'COMPLETED', 'FAILED'], default: 'COMPLETED' },
  recommended_action: { type: String, default: '' },
  raw_response: { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('VisualAnalysis', visualAnalysisSchema);
