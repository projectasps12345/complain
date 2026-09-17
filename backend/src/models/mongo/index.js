const Department = require('./Department');
const User = require('./User');
const Complaint = require('./Complaint');
const ComplaintTimeline = require('./ComplaintTimeline');
const Feedback = require('./Feedback');
const Notification = require('./Notification');
const ComplaintEvidence = require('./ComplaintEvidence');
const VisualAnalysis = require('./VisualAnalysis');
const EvidenceAuditLog = require('./EvidenceAuditLog');
const { Counter, getNextSequence } = require('./Counter');
const LocationModels = require('./Location');

module.exports = {
  Department,
  User,
  Complaint,
  ComplaintEvidence,
  VisualAnalysis,
  EvidenceAuditLog,
  ComplaintTimeline,
  Feedback,
  Notification,
  Counter,
  getNextSequence,
  ...LocationModels
};
