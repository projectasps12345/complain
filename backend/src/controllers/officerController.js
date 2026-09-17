const db = require('../models/db');
const cloudinaryService = require('../services/cloudinaryService');
const mlClient = require('../services/mlClient');

class OfficerController {
  /**
   * Get all tasks assigned to the authenticated field officer
   */
  getMyAssignedTasks(req, res) {
    try {
      const officerId = req.user.id;
      const deptId = req.user.department_id;
      
      let tasks;
      if (deptId) {
        // Fetch all complaints assigned to this officer OR to their department taskforce
        tasks = db.prepare('SELECT * FROM complaints WHERE officer_id = ? OR department_id = ?').all(officerId, deptId);
      } else {
        tasks = db.prepare('SELECT * FROM complaints WHERE officer_id = ?').all(officerId);
      }

      tasks = tasks.map(t => {
        const evidence = db.getEvidenceByComplaintId(t.id);
        return {
          ...t,
          evidence
        };
      });

      res.json({ tasks });
    } catch (err) {
      console.error('Officer tasks error:', err);
      res.status(500).json({ error: 'Failed to fetch assigned tasks' });
    }
  }

  /**
   * Update task status (Mark In Progress or Resolve with proof photo)
   */
  async updateTaskStatus(req, res) {
    try {
      const officerId = req.user.id;
      const officerName = req.user.name || 'Field Officer';
      const { id } = req.params;
      const { status, notes } = req.body;

      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      // Check authorization (assigned officer or officer in same department or admin)
      const isAssigned = complaint.officer_id === officerId;
      const isDeptOfficer = req.user.department_id && complaint.department_id === req.user.department_id;
      const isAdmin = req.user.role === 'admin';

      if (!isAssigned && !isDeptOfficer && !isAdmin) {
        return res.status(403).json({ error: 'You are not assigned to this complaint or department' });
      }

      let resolutionImageUrl = complaint.resolution_image_url;
      let resolutionEvidenceRecord = null;

      const uploadedFile = req.file || req.files?.resolution_image?.[0] || req.files?.image?.[0];

      if (uploadedFile) {
        try {
          const uploadRes = await cloudinaryService.uploadEvidence(uploadedFile.path, {
            complaintId: complaint.tracking_id || complaint.id,
            folderType: 'resolution',
            resourceType: 'image',
            originalFilename: req.file.originalname,
            tags: ['resolution', complaint.category]
          });

          resolutionImageUrl = uploadRes.secure_url;

          resolutionEvidenceRecord = db.insertEvidence({
            complaint_id: complaint.id,
            uploaded_by: officerId,
            cloudinary_public_id: uploadRes.cloudinary_public_id,
            cloudinary_url: uploadRes.cloudinary_url,
            secure_url: uploadRes.secure_url,
            resource_type: uploadRes.resource_type,
            format: uploadRes.format,
            original_filename: uploadRes.original_filename,
            file_size: uploadRes.file_size,
            width: uploadRes.width,
            height: uploadRes.height,
            thumbnail_url: uploadRes.thumbnail_url,
            evidence_type: 'resolution',
            is_sensitive: Boolean(complaint.is_crime || complaint.is_sensitive)
          });

          db.logEvidenceAudit({
            complaint_id: complaint.id,
            evidence_id: resolutionEvidenceRecord.id,
            cloudinary_public_id: uploadRes.cloudinary_public_id,
            action: 'UPLOAD',
            user_id: officerId,
            user_role: 'officer',
            user_name: officerName,
            ip_address: req.ip || '127.0.0.1',
            details: `Officer uploaded resolution proof photo: ${req.file.originalname} to Cloudinary`
          });
        } catch (uploadErr) {
          console.error('Resolution photo upload error:', uploadErr);
          resolutionImageUrl = `/uploads/${req.file.filename}`;
        }
      } else if (req.body.resolution_image_url) {
        resolutionImageUrl = req.body.resolution_image_url;
      }

      if (status === 'Resolved') {
        db.prepare(`
          UPDATE complaints
          SET status = 'Resolved',
              resolution_notes = ?,
              resolution_image_url = ?,
              resolution_evidence_id = ?,
              officer_id = ?,
              resolved_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(notes || 'Issue successfully resolved on-site.', resolutionImageUrl, resolutionEvidenceRecord?.id || null, officerId, complaint.id);

        db.prepare(`
          INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(complaint.id, 'Resolved', notes || 'Work completed and verified on ground.', officerName, officerId);

        // Notify citizen to provide feedback & rating
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, link)
          VALUES (?, 'Complaint Resolved! 🎉', ?, ?)
        `).run(
          complaint.citizen_id,
          `Your complaint #${complaint.tracking_id} (${complaint.category}) has been resolved. Please rate our service!`,
          `/complaints/${complaint.id}`
        );
      } else if (status === 'In Progress') {
        db.prepare(`
          UPDATE complaints
          SET status = ?,
              officer_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run('In Progress', officerId, complaint.id);

        db.prepare(`
          INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(complaint.id, 'In Progress', notes || 'Field officer dispatched and investigation/repair in progress.', officerName, officerId);

        db.prepare(`
          INSERT INTO notifications (user_id, title, message, link)
          VALUES (?, 'Work in Progress', ?, ?)
        `).run(
          complaint.citizen_id,
          `Officer ${officerName} is actively working on your complaint #${complaint.tracking_id}.`,
          `/complaints/${complaint.id}`
        );
      } else {
        db.prepare(`
          UPDATE complaints
          SET status = ?,
              officer_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(status, officerId, complaint.id);

        db.prepare(`
          INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(complaint.id, status, notes || `Status updated to ${status}`, officerName, officerId);
      }

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaint.id);
      const timeline = db.prepare('SELECT * FROM complaint_timeline WHERE complaint_id = ?').all(complaint.id);

      res.json({
        message: `Task marked as ${status}`,
        complaint: updated,
        timeline
      });
    } catch (err) {
      console.error('Update task status error:', err);
      res.status(500).json({ error: 'Failed to update task status' });
    }
  }
}

module.exports = new OfficerController();
