from typing import Dict, List, Any, Optional

PRIORITY_LEVELS = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4
}

NUM_TO_PRIORITY = {v: k for k, v in PRIORITY_LEVELS.items()}

class MultimodalFusionEngine:
    """
    Multimodal AI Risk Fusion Engine
    Fuses Text NLP Classification + Visual Hazard Detection + Sensitive Geospatial Context
    + Population Density into a single, explainable final civic priority.
    """

    def evaluate(
        self,
        text_priority: str = "MEDIUM",
        text_category: str = "",
        text_subcategory: str = "",
        visual_severity: Optional[str] = None,
        visual_label: Optional[str] = None,
        location_type: str = "Residential",
        affected_count: int = 50,
        is_emergency: bool = False,
        evidence_consistency: str = "MATCH"
    ) -> Dict[str, Any]:
        risk_factors: List[str] = []
        text_prio = text_priority.upper() if text_priority else "MEDIUM"
        vis_sev = visual_severity.upper() if visual_severity else None

        # Start with numeric score based on text prediction
        score = PRIORITY_LEVELS.get(text_prio, 2)

        # 1. Emergency Override
        if is_emergency:
            return {
                "text_priority": text_prio,
                "visual_priority": vis_sev or text_prio,
                "final_priority": "CRITICAL",
                "sla_hours": 24,
                "risk_factors": ["Immediate Emergency / Threat Flagged", "Urgent Citizen Safety Intervention Required"],
                "decision_reason": "Emergency flag triggered immediate escalation to CRITICAL (24-hour SLA)."
            }

        # 2. Location Vulnerability Analysis
        loc_lower = location_type.lower()
        is_sensitive_zone = False
        if any(zone in loc_lower for zone in ['school', 'kindergarten', 'college']):
            risk_factors.append("High-Exposure School / Educational Zone (Vulnerable Children)")
            is_sensitive_zone = True
        elif any(zone in loc_lower for zone in ['hospital', 'clinic', 'medical', 'emergency']):
            risk_factors.append("Critical Healthcare Access Corridor (Hospital Emergency Route)")
            is_sensitive_zone = True
        elif any(zone in loc_lower for zone in ['highway', 'flyover', 'expressway', 'main road']):
            risk_factors.append("High-Speed Arterial Thoroughfare / Vehicular Corridor")
            is_sensitive_zone = True
        elif any(zone in loc_lower for zone in ['market', 'bazaar', 'station', 'bus terminus']):
            risk_factors.append("High Footfall Commercial / Commuter Congestion Hub")
            is_sensitive_zone = True

        # 3. Visual Detection Impact
        if visual_label == 'open_manhole':
            risk_factors.append("Severe Subterranean Fall & Inundation Hazard (Open Manhole)")
            if is_sensitive_zone:
                # Open manhole in school / hospital zone is unconditionally CRITICAL
                return {
                    "text_priority": text_prio,
                    "visual_priority": "CRITICAL",
                    "final_priority": "CRITICAL",
                    "sla_hours": 24,
                    "risk_factors": risk_factors + ["Pedestrian Exposure Hazard", "Fall Danger Near School Corridor"],
                    "decision_reason": "Open manhole cavity confirmed in high-density sensitive pedestrian zone escalated to CRITICAL."
                }
            else:
                score = max(score, 3) # At least HIGH

        elif visual_label == 'electrical_hazard':
            risk_factors.append("Live Overhead Conductor / Electrical Shock Exposure")
            return {
                "text_priority": text_prio,
                "visual_priority": "CRITICAL",
                "final_priority": "CRITICAL",
                "sla_hours": 24,
                "risk_factors": risk_factors + ["Electrocution Risk", "Active Electrical Infrastructure Anomaly"],
                "decision_reason": "Exposed electrical hazard presents immediate life-safety peril."
            }

        elif visual_label == 'pothole':
            risk_factors.append("Vehicle Axle Damage & Sudden Braking Hazard")
            if is_sensitive_zone or score >= 3:
                score = max(score, 3) # HIGH
                risk_factors.append("Roadway Discontinuity Along Active Transit Channel")

        elif visual_label == 'broken_streetlight':
            # Streetlight should remain LOW unless already flagged critical
            risk_factors.append("Civic Luminaire Outage / Night Illumination Deficit")
            if score < 3:
                score = min(score, 2) # keep at LOW or MEDIUM

        # 4. Population Impact Multiplier
        if affected_count >= 200:
            risk_factors.append(f"Major Community Exposure ({affected_count}+ residents impacted)")
            score = min(4, score + 1)
        elif affected_count >= 50:
            risk_factors.append(f"Moderate Neighborhood Impact ({affected_count} residents)")

        # 5. Consistency Validation
        if evidence_consistency == 'POSSIBLE MISMATCH':
            risk_factors.append("⚠️ Visual Evidence Requires Verification (Potential Description Mismatch)")

        # Map back to priority string
        final_prio = NUM_TO_PRIORITY.get(min(4, max(1, score)), "MEDIUM")
        sla_hours = 24 if final_prio == "CRITICAL" else (48 if final_prio == "HIGH" else (72 if final_prio == "MEDIUM" else 120))

        # Human-readable decision reason
        if final_prio == "CRITICAL":
            reason = "Immediate hazard detected posing severe public safety exposure; routed with highest urgency."
        elif final_prio == "HIGH":
            reason = "Significant structural degradation or high pedestrian/traffic exposure confirmed by multimodal analysis."
        elif final_prio == "MEDIUM":
            reason = "Routine community maintenance requirement verified with standard operational SLA."
        else:
            reason = "Low risk civic maintenance; standard scheduling without immediate hazard."

        return {
            "text_priority": text_prio,
            "visual_priority": vis_sev or text_prio,
            "final_priority": final_prio,
            "sla_hours": sla_hours,
            "risk_factors": risk_factors,
            "decision_reason": reason
        }

multimodal_fusion = MultimodalFusionEngine()
