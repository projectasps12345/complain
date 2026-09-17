const db = require('../models/db');
const mlClient = require('../services/mlClient');
const assignmentService = require('../services/assignmentService');
const imageVerificationService = require('../services/imageVerificationService');
const cloudinaryService = require('../services/cloudinaryService');
const upload = require('../middleware/uploadMiddleware');

class ComplaintController {
  /**
   * Real-time preview of ML Category, Priority, Duplicate Check and Resolution Time
   */
  async previewML(req, res) {
    try {
      const { text, latitude, longitude, severity, location_type, ward, affected_count } = req.body;
      if (!text || text.trim().length < 5) {
        return res.json({
          preview: null,
          message: 'Provide at least 5 characters for ML analysis'
        });
      }

      // Fetch active complaints for spatial duplicate comparison
      const activeComplaints = db.prepare('SELECT * FROM complaints WHERE status NOT IN (?, ?)').all('Resolved', 'Rejected');

      const mlResult = await mlClient.predictAll({
        text,
        latitude: Number(latitude) || 22.9750,
        longitude: Number(longitude) || 88.4340,
        severity: severity || 'Medium',
        location_type: location_type || 'Residential',
        ward: ward || 'Ward 1',
        affected_count: Number(affected_count) || 50,
        existing_complaints: activeComplaints
      });

      res.json({ preview: mlResult });
    } catch (err) {
      console.error('ML Preview error:', err);
      res.status(500).json({ error: 'Failed to process ML preview' });
    }
  }

  /**
   * Submits a new citizen complaint
   */
  async createComplaint(req, res) {
    try {
      const citizenId = req.user.id;
      const {
        title,
        description,
        latitude,
        longitude,
        address,
        ward,
        location_type,
        affected_count,
        severity,
        category: manualCategory,
        subcategory: manualSubcategory,
        is_emergency: manualEmergency,
        // Normalized location fields:
        state,
        district_id,
        district,
        subdivision_id,
        subdivision,
        administrative_type,
        ulb_id,
        ulb_type,
        municipality,
        ward_id,
        block_id,
        block,
        gram_panchayat_id,
        gram_panchayat,
        village_id,
        village,
        mouza,
        police_station_id,
        police_station,
        locality,
        landmark,
        postal_code
      } = req.body;

      if (!description || description.trim().length < 5) {
        return res.status(400).json({ error: 'Complaint description is required' });
      }

      // 1. Get active complaints for duplicate detection
      const activeComplaints = db.prepare('SELECT * FROM complaints WHERE status NOT IN (?, ?)').all('Resolved', 'Rejected');

      // 2. Query ML Microservice for Category, Priority, Duplicate, and Resolution Days
      const lat = Number(latitude) || 22.7230;
      const lng = Number(longitude) || 88.4800;

      const locationContext = {
        administrative_type: administrative_type || 'Urban',
        municipality: municipality || '',
        block: block || '',
        ward: ward || '',
        gram_panchayat: gram_panchayat || '',
        village: village || '',
        district: district || 'North 24 Parganas',
        police_station: police_station || ''
      };

      const mlRes = await mlClient.predictAll({
        text: `${title || ''} ${description}`,
        latitude: lat,
        longitude: lng,
        severity: severity || 'Medium',
        location_type: location_type || 'Residential',
        ward: ward || gram_panchayat || 'Ward 1',
        affected_count: Number(affected_count) || 50,
        existing_complaints: activeComplaints
      });

      const predictedCategory = mlRes.category_prediction.category;
      const predictedSubcategory = mlRes.category_prediction.subcategory || mlRes.summary.subcategory || 'General Issue';
      const mlConfidence = mlRes.category_prediction.confidence;
      const isCrimeDetected = mlRes.summary.is_crime || ['Police & Law Enforcement', 'Cyber Crime', 'Women & Child Safety'].includes(predictedCategory);
      const isEmergencyDetected = Boolean(manualEmergency || mlRes.summary.is_emergency);

      // Category & Subcategory: Use manual choice if selected, otherwise ML prediction
      const finalCategory = (manualCategory && manualCategory !== 'AI Auto Detect' && manualCategory !== 'Auto-Detect with AI') 
        ? manualCategory 
        : predictedCategory;

      const finalSubcategory = (manualSubcategory && manualSubcategory !== 'All' && manualSubcategory !== 'General')
        ? manualSubcategory
        : predictedSubcategory;

      let predictedPriority = mlRes.priority_prediction.priority;
      if (isEmergencyDetected && predictedPriority !== 'CRITICAL') {
        predictedPriority = 'CRITICAL';
      }

      const slaHours = isEmergencyDetected ? 24 : (mlRes.priority_prediction.sla_hours || 72);
      const predictedDays = mlRes.resolution_prediction.estimated_days || 3.0;

      const isDup = mlRes.duplicate_detection.is_duplicate ? 1 : 0;
      const dupMatchId = mlRes.duplicate_detection.matched_complaint_id;
      const dupSim = mlRes.duplicate_detection.max_similarity || 0;

      // 3. Department & Officer Auto-Assignment with Location Jurisdiction
      const departmentId = assignmentService.getDepartmentForCategory(finalCategory, locationContext);
      const officerId = assignmentService.findBestOfficer(departmentId, locationContext);

      // Tracking ID: CMP-{Year}-{Random 5 digits}
      const trackingId = `CMP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      // 4. Multi-File Cloudinary Evidence Processing
      let rawFiles = [];
      if (req.files) {
        if (Array.isArray(req.files)) rawFiles = req.files;
        else {
          if (req.files.evidence) rawFiles = rawFiles.concat(req.files.evidence);
          if (req.files.image) rawFiles = rawFiles.concat(req.files.image);
        }
      } else if (req.file) {
        rawFiles = [req.file];
      }

      const uploadedEvidenceItems = [];
      let primaryImageUrl = req.body.image_url || null;
      let primaryVisualAnalysis = null;

      for (const file of rawFiles) {
        const validation = upload.validateUploadedFile(file);
        if (validation.valid) {
          const isVideo = validation.isVideo;
          const uploadRes = await cloudinaryService.uploadEvidence(file.path, {
            complaintId: trackingId,
            folderType: isVideo ? 'videos' : 'images',
            resourceType: isVideo ? 'video' : 'image',
            originalFilename: file.originalname,
            tags: ['complaint', finalCategory]
          });

          uploadedEvidenceItems.push({
            file,
            uploadRes,
            isVideo
          });

          if (!isVideo && !primaryImageUrl) {
            primaryImageUrl = uploadRes.secure_url;
          }
        }
      }

      // 5. AI Computer Vision & Multimodal Priority Fusion
      if (primaryImageUrl) {
        try {
          primaryVisualAnalysis = await mlClient.analyzeVisualEvidence({
            imageUrl: primaryImageUrl,
            textCategory: finalCategory,
            textSubcategory: finalSubcategory,
            description: description.trim()
          });
        } catch (visErr) {
          console.warn('Initial visual analysis failed:', visErr.message);
        }
      }

      // Fuse Text + Vision + Location + Density
      const multimodalResult = await mlClient.fuseMultimodalPriority({
        text_priority: predictedPriority,
        text_category: finalCategory,
        text_subcategory: finalSubcategory,
        visual_severity: primaryVisualAnalysis?.visual_severity,
        visual_label: primaryVisualAnalysis?.detected_label,
        location_type: location_type || 'Residential',
        affected_count: Number(affected_count) || 50,
        is_emergency: isEmergencyDetected,
        evidence_consistency: primaryVisualAnalysis?.evidence_consistency || 'MATCH'
      });

      const finalPriority = multimodalResult.final_priority || predictedPriority;
      const effectiveSlaHours = isEmergencyDetected ? 24 : (multimodalResult.sla_hours || slaHours);
      const slaDeadline = new Date(Date.now() + effectiveSlaHours * 60 * 60 * 1000).toISOString();

      let imageVerificationReport = null;
      if (primaryImageUrl) {
        imageVerificationReport = imageVerificationService.verifyImage(primaryImageUrl, finalCategory, finalSubcategory, description);
      }

      const locationLabel = village || locality || ward || municipality || block || 'West Bengal';
      const complaintTitle = title && title.trim() ? title.trim() : `${finalCategory} - ${finalSubcategory} at ${locationLabel}`;

      // Insert Complaint with full normalized location hierarchy & multimodal priorities
      const insertInfo = db.insertComplaint({
        tracking_id: trackingId,
        citizen_id: citizenId,
        title: complaintTitle,
        description: description.trim(),
        category: finalCategory,
        subcategory: finalSubcategory,
        priority: finalPriority,
        text_priority: predictedPriority,
        visual_priority: primaryVisualAnalysis?.visual_severity || predictedPriority,
        final_priority: finalPriority,
        status: officerId ? 'Assigned' : 'Verified',
        department_id: departmentId,
        officer_id: officerId,
        latitude: lat,
        longitude: lng,
        address: address || `${locationLabel}, ${district || 'North 24 Parganas'}`,
        // Normalized location fields:
        state: state || 'West Bengal',
        district_id: district_id ? Number(district_id) : null,
        district: district || 'North 24 Parganas',
        subdivision_id: subdivision_id ? Number(subdivision_id) : null,
        subdivision: subdivision || '',
        administrative_type: administrative_type || 'Urban',
        ulb_id: ulb_id ? Number(ulb_id) : null,
        ulb_type: ulb_type || null,
        municipality: municipality || '',
        ward_id: ward_id ? Number(ward_id) : null,
        ward: ward || '',
        block_id: block_id ? Number(block_id) : null,
        block: block || '',
        gram_panchayat_id: gram_panchayat_id ? Number(gram_panchayat_id) : null,
        gram_panchayat: gram_panchayat || '',
        village_id: village_id ? Number(village_id) : null,
        village: village || '',
        mouza: mouza || '',
        police_station_id: police_station_id ? Number(police_station_id) : null,
        police_station: police_station || '',
        locality: locality || '',
        landmark: landmark || '',
        postal_code: postal_code || '',
        location_type: location_type || 'Residential',
        affected_count: Number(affected_count) || 50,
        image_url: primaryImageUrl,
        image_verification_report: imageVerificationReport,
        impact_score: mlRes.impact_assessment?.score || mlRes.summary?.impact_score || 50,
        impact_label: mlRes.impact_assessment?.label || mlRes.summary?.impact_label || 'Moderate Public Impact',
        root_causes: mlRes.root_cause_analysis?.possible_causes || [],
        recommended_actions: mlRes.root_cause_analysis?.recommended_actions || [],
        detected_language: mlRes.summary?.detected_language || 'en',
        upvote_count: 0,
        upvoter_ids: [],
        is_duplicate: isDup,
        duplicate_of_id: dupMatchId ? Number(dupMatchId) : null,
        duplicate_similarity: dupSim,
        ml_confidence: mlConfidence,
        ml_predicted_category: predictedCategory,
        ml_predicted_priority: finalPriority,
        predicted_category: predictedCategory,
        predicted_subcategory: predictedSubcategory,
        is_emergency: isEmergencyDetected ? 1 : 0,
        is_crime: isCrimeDetected ? 1 : 0,
        is_sensitive: isCrimeDetected ? 1 : 0,
        predicted_resolution_days: predictedDays,
        sla_deadline: slaDeadline
      });

      const newComplaintId = insertInfo.id;

      // 6. Record Evidence & Visual Analysis in DB with Audit Trail
      for (const item of uploadedEvidenceItems) {
        const evRecord = db.insertEvidence({
          complaint_id: newComplaintId,
          uploaded_by: citizenId,
          cloudinary_public_id: item.uploadRes.cloudinary_public_id,
          cloudinary_url: item.uploadRes.cloudinary_url,
          secure_url: item.uploadRes.secure_url,
          resource_type: item.uploadRes.resource_type,
          format: item.uploadRes.format,
          original_filename: item.uploadRes.original_filename,
          file_size: item.uploadRes.file_size,
          width: item.uploadRes.width,
          height: item.uploadRes.height,
          duration: item.uploadRes.duration,
          thumbnail_url: item.uploadRes.thumbnail_url,
          blurred_url: cloudinaryService.getBlurredUrl(item.uploadRes.cloudinary_public_id, { resourceType: item.uploadRes.resource_type }),
          evidence_type: 'initial',
          is_sensitive: Boolean(isCrimeDetected)
        });

        db.logEvidenceAudit({
          complaint_id: newComplaintId,
          evidence_id: evRecord.id,
          cloudinary_public_id: item.uploadRes.cloudinary_public_id,
          action: 'UPLOAD',
          user_id: citizenId,
          user_role: req.user.role,
          user_name: req.user.name,
          ip_address: req.ip || '127.0.0.1',
          details: `Uploaded ${item.file.originalname} (${(item.file.size / (1024 * 1024)).toFixed(2)} MB)`
        });

        // If primary visual analysis, link to evidence
        if (primaryVisualAnalysis && !item.isVideo && !primaryVisualAnalysis.saved) {
          const vRecord = db.insertVisualAnalysis({
            complaint_id: newComplaintId,
            complaint_evidence_id: evRecord.id,
            model_name: primaryVisualAnalysis.model_name,
            model_version: primaryVisualAnalysis.model_version,
            image_quality: primaryVisualAnalysis.image_quality,
            quality_metrics: primaryVisualAnalysis.quality_metrics,
            detected_objects: primaryVisualAnalysis.detected_objects,
            visual_severity: primaryVisualAnalysis.visual_severity,
            visual_risk: primaryVisualAnalysis.visual_risk,
            evidence_consistency: primaryVisualAnalysis.evidence_consistency,
            consistency_details: primaryVisualAnalysis.consistency_details,
            confidence: primaryVisualAnalysis.confidence,
            analysis_status: primaryVisualAnalysis.analysis_status,
            recommended_action: primaryVisualAnalysis.recommended_action
          });
          primaryVisualAnalysis.saved = true;
        }
      }

      // 7. Add initial timeline log
      db.prepare(`
        INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
        VALUES (?, 'Submitted', ?, 'Multimodal AI Pipeline', NULL)
      `).run(newComplaintId, `Registered with Multimodal AI Fusion: Category=${finalCategory}, Priority=${finalPriority} (Text: ${predictedPriority}, Visual: ${primaryVisualAnalysis?.visual_severity || 'N/A'}).`);

      if (officerId) {
        db.prepare(`
          INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
          VALUES (?, 'Assigned', 'Department and Field Officer automatically routed based on AI categorization.', 'Smart Routing Engine', NULL)
        `).run(newComplaintId);
      }

      // 6. Create citizen notification
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, link)
        VALUES (?, 'Complaint Registered', ?, ?)
      `).run(
        citizenId,
        `Your complaint #${trackingId} (${finalCategory} - ${predictedPriority} Priority) has been received.`,
        `/complaints/${newComplaintId}`
      );

      const createdComplaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(newComplaintId);

      res.status(201).json({
        message: 'Complaint submitted successfully',
        complaint: createdComplaint,
        ai_summary: mlRes.summary,
        duplicate_match: mlRes.duplicate_detection?.is_duplicate ? mlRes.duplicate_detection.matches[0] : null
      });
    } catch (err) {
      console.error('Complaint creation error:', err);
      res.status(500).json({ error: 'Failed to create complaint' });
    }
  }

  /**
   * Get all complaints submitted by the authenticated citizen
   */
  getMyComplaints(req, res) {
    try {
      const citizenId = req.user.id;
      const complaints = db.prepare('SELECT * FROM complaints WHERE citizen_id = ?').all(citizenId);
      res.json({ complaints });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch your complaints' });
    }
  }

  /**
   * Public complaints feed for GIS map and transparency board (with Crime Data Privacy Protection)
   */
  getPublicComplaints(req, res) {
    try {
      const complaints = db.prepare('SELECT * FROM complaints').all();

      // Privacy Protection for Crime and Sensitive Cases
      const publicList = complaints.map(c => {
        const isCrime = c.is_crime === 1 || c.is_crime === true || ['Police & Law Enforcement', 'Cyber Crime', 'Women & Child Safety'].includes(c.category);

        if (isCrime) {
          // Approximate location coordinates (+- 0.003 jitter) to prevent locating victim residence
          const latJitter = c.latitude ? Number((c.latitude + 0.002).toFixed(4)) : 22.9750;
          const lngJitter = c.longitude ? Number((c.longitude + 0.002).toFixed(4)) : 88.4340;

          return {
            id: c.id,
            tracking_id: c.tracking_id,
            title: `[Protected] ${c.category} - ${c.subcategory || 'Incident Report'}`,
            category: c.category,
            subcategory: c.subcategory,
            priority: c.priority,
            status: c.status,
            latitude: latJitter,
            longitude: lngJitter,
            ward: c.ward,
            address: `${c.ward || 'Municipal Ward'} (Protected Law Enforcement Case)`,
            image_url: null, // Redacted for victim privacy
            resolution_image_url: null,
            is_crime: true,
            is_sensitive: true,
            created_at: c.created_at,
            resolved_at: c.resolved_at
          };
        }

        return {
          id: c.id,
          tracking_id: c.tracking_id,
          title: c.title,
          category: c.category,
          subcategory: c.subcategory,
          priority: c.priority,
          status: c.status,
          latitude: c.latitude,
          longitude: c.longitude,
          ward: c.ward,
          address: c.address,
          image_url: c.image_url,
          resolution_image_url: c.resolution_image_url,
          is_crime: false,
          is_sensitive: false,
          created_at: c.created_at,
          resolved_at: c.resolved_at
        };
      });

      res.json({ complaints: publicList });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch public complaints' });
    }
  }

  /**
   * Get specific complaint details by ID with full timeline and feedback
   */
  getComplaintById(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;
      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);

      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      const timeline = db.prepare('SELECT * FROM complaint_timeline WHERE complaint_id = ?').all(complaint.id);
      const feedback = db.prepare('SELECT * FROM feedback WHERE complaint_id = ?').get(complaint.id);

      // Fetch Evidence Items and AI Visual Analyses
      const evidenceList = db.getEvidenceByComplaintId(complaint.id);
      const visualAnalyses = db.getVisualAnalysisByComplaintId(complaint.id);

      // Check RBAC permissions
      const isOwner = user && complaint.citizen_id === user.id;
      const isOfficer = user && user.role === 'officer' && (complaint.officer_id === user.id || complaint.department_id === user.department_id);
      const isAdmin = user && user.role === 'admin';
      const hasFullAccess = isOwner || isOfficer || isAdmin;

      // Filter evidence for privacy if sensitive crime report
      let safeEvidence = evidenceList;
      if (complaint.is_crime || complaint.is_sensitive) {
        if (!hasFullAccess) {
          safeEvidence = [];
        }
      }

      const enrichedEvidence = safeEvidence.map(item => {
        const analysis = visualAnalyses.find(v => v.complaint_evidence_id === item.id || v.id === item.ai_analysis_id);
        const isCloud = !item.cloudinary_public_id?.startsWith('local_');

        return {
          ...item,
          optimized_url: isCloud ? cloudinaryService.getOptimizedUrl(item.cloudinary_public_id, { resourceType: item.resource_type }) : item.secure_url,
          thumbnail_url: item.thumbnail_url || (isCloud ? cloudinaryService.getThumbnailUrl(item.cloudinary_public_id, { resourceType: item.resource_type }) : item.secure_url),
          blurred_url: item.blurred_url || (isCloud ? cloudinaryService.getBlurredUrl(item.cloudinary_public_id, { resourceType: item.resource_type }) : item.secure_url),
          visual_analysis: analysis || null
        };
      });

      res.json({
        complaint: {
          ...complaint,
          evidence: enrichedEvidence,
          visual_analyses: hasFullAccess ? visualAnalyses : []
        },
        timeline,
        feedback: feedback || null
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch complaint details' });
    }
  }

  /**
   * Citizen community upvote / endorsement (+1 support)
   */
  async upvoteComplaint(req, res) {
    try {
      const { id } = req.params;
      const citizenId = req.user.id;
      const citizenName = req.user.name || 'Citizen';

      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      const upvoters = Array.isArray(complaint.upvoter_ids) ? complaint.upvoter_ids : [];
      if (upvoters.includes(citizenId)) {
        return res.status(400).json({ error: 'You have already endorsed this complaint', already_upvoted: true });
      }

      upvoters.push(citizenId);
      const newUpvoteCount = (complaint.upvote_count || 0) + 1;
      const newAffectedCount = (complaint.affected_count || 10) + 1;
      const newImpactScore = Math.min(100, (complaint.impact_score || 50) + 2);

      db.prepare(`
        UPDATE complaints
        SET upvote_count = ?,
            affected_count = ?,
            impact_score = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newUpvoteCount, newAffectedCount, newImpactScore, complaint.id);

      db.prepare(`
        INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        complaint.id,
        complaint.status,
        `Community endorsement (+1 affected) registered by ${citizenName}. Total citizen supporters: ${newUpvoteCount}. Impact score elevated to ${newImpactScore}/100.`,
        'Community Support Engine',
        citizenId
      );

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);

      res.json({
        message: 'Community support registered successfully!',
        upvote_count: newUpvoteCount,
        affected_count: newAffectedCount,
        impact_score: newImpactScore,
        complaint: updated
      });
    } catch (err) {
      console.error('Upvote error:', err);
      res.status(500).json({ error: 'Failed to record community support' });
    }
  }

  /**
   * Citizen Reopens Resolved Complaint
   */
  async reopenComplaint(req, res) {
    try {
      const { id } = req.params;
      const citizenId = req.user.id;
      const citizenName = req.user.name || 'Citizen';
      const { reason, notes } = req.body;

      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      if (complaint.status !== 'Resolved') {
        return res.status(400).json({ error: 'Only resolved complaints can be reopened' });
      }

      const reopenCount = (complaint.reopen_count || 0) + 1;
      const reopenReason = reason || notes || 'Citizen reported the issue persists on ground.';

      db.prepare(`
        UPDATE complaints
        SET status = 'In Progress',
            priority = 'HIGH',
            is_escalated = 1,
            escalation_level = CASE WHEN escalation_level < 2 THEN escalation_level + 1 ELSE escalation_level END,
            reopen_count = ?,
            reopen_reason = ?,
            resolved_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reopenCount, reopenReason, complaint.id);

      db.prepare(`
        INSERT INTO complaint_timeline (complaint_id, status, notes, updated_by_name, updated_by_user_id)
        VALUES (?, 'In Progress', ?, ?, ?)
      `).run(
        complaint.id,
        `⚠️ COMPLAINT REOPENED by citizen: "${reopenReason}". Escalated to priority HIGH for departmental re-investigation.`,
        citizenName,
        citizenId
      );

      // Notify assigned officer
      if (complaint.officer_id) {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, link)
          VALUES (?, '⚠️ Complaint Reopened by Citizen', ?, ?)
        `).run(
          complaint.officer_id,
          `Citizen reported issue persists on #${complaint.tracking_id} ("${reopenReason}"). Immediate inspection required.`,
          `/complaints/${complaint.id}`
        );
      }

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      res.json({
        message: 'Complaint successfully reopened and escalated for re-investigation',
        complaint: updated
      });
    } catch (err) {
      console.error('Reopen error:', err);
      res.status(500).json({ error: 'Failed to reopen complaint' });
    }
  }
}

module.exports = new ComplaintController();
