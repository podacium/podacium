"""
Decision Intelligence Service
Generates actionable recommendations and insights.
"""

from typing import Any, Dict, List, Optional


class DecisionService:
    """Service for generating decision intelligence"""
    
    @classmethod
    def generate_decisions(
        cls,
        analytics_result: Dict[str, Any],
        evaluation_result: Dict[str, Any],
        domain: str = "unknown"
    ) -> Dict[str, Any]:
        """Generate decision intelligence from analytics and evaluation"""
        
        # Extract key information
        business_insights = analytics_result.get("business_insights", [])
        confidence_level = evaluation_result.get("confidence_level", "LOW")
        risk_level = evaluation_result.get("risk_level", "HIGH")
        limitations = evaluation_result.get("limitations", [])
        
        # Generate recommendations
        recommendations = cls._generate_recommendations(
            business_insights, confidence_level, risk_level, domain
        )
        
        # Generate expected impact
        expected_impact = cls._assess_expected_impact(
            business_insights, confidence_level
        )
        
        # Generate explanation
        explanation = cls._generate_explanation(
            recommendations, confidence_level, risk_level
        )
        
        # Generate warnings
        warnings = cls._generate_warnings(
            confidence_level, risk_level, limitations
        )
        
        return {
            "recommendations": recommendations,
            "expected_impact": expected_impact,
            "explanation": explanation,
            "warnings": warnings,
            "context": {
                "confidence_level": confidence_level,
                "risk_level": risk_level,
                "domain": domain,
                "insight_count": len(business_insights)
            }
        }
    
    @classmethod
    def _generate_recommendations(
        cls,
        business_insights: List[Dict[str, Any]],
        confidence_level: str,
        risk_level: str,
        domain: str
    ) -> List[Dict[str, Any]]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Always include data quality recommendations
        if confidence_level == "LOW" or risk_level == "HIGH":
            recommendations.append({
                "text": "Improve data collection processes to enhance data quality and reliability",
                "category": "DATA_QUALITY",
                "priority": "HIGH",
                "effort": "MEDIUM",
                "expected_benefit": "High - will improve all future analyses"
            })
        
        # Domain-specific recommendations
        domain_recs = cls._get_domain_recommendations(domain, business_insights)
        recommendations.extend(domain_recs)
        
        # Insight-based recommendations
        for insight in business_insights:
            if insight.get("importance") == "HIGH":
                rec = cls._insight_to_recommendation(insight, domain)
                if rec:
                    recommendations.append(rec)
        
        # If confidence is high, add more actionable recommendations
        if confidence_level == "HIGH" and len(recommendations) < 3:
            recommendations.extend([
                {
                    "text": "Establish regular monitoring of key metrics to track performance",
                    "category": "MONITORING",
                    "priority": "MEDIUM",
                    "effort": "LOW",
                    "expected_benefit": "Medium - enables proactive management"
                },
                {
                    "text": "Conduct deeper analysis on top-performing areas to understand drivers",
                    "category": "ANALYSIS",
                    "priority": "MEDIUM",
                    "effort": "HIGH",
                    "expected_benefit": "High - can uncover optimization opportunities"
                }
            ])
        
        # Deduplicate and limit
        seen_texts = set()
        unique_recs = []
        for rec in recommendations:
            if rec["text"] not in seen_texts:
                seen_texts.add(rec["text"])
                unique_recs.append(rec)
        
        return unique_recs[:10]  # Limit to top 10
    
    @staticmethod
    def _get_domain_recommendations(
        domain: str,
        business_insights: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate domain-specific recommendations"""
        # Mock data removed during E1 stub purge
        return []
    
    @staticmethod
    def _insight_to_recommendation(
        insight: Dict[str, Any],
        domain: str
    ) -> Optional[Dict[str, Any]]:
        """Convert business insight to recommendation"""
        insight_type = insight.get("type", "")
        title = insight.get("title", "")
        description = insight.get("description", "")
        
        if "trend" in insight_type.lower():
            return {
                "text": f"Take action to capitalize on the identified trend: {description}",
                "category": "TREND_RESPONSE",
                "priority": "HIGH",
                "effort": "MEDIUM",
                "expected_benefit": "High - timely response to trends"
            }
        
        if "dominance" in insight_type.lower():
            return {
                "text": f"Diversify focus beyond the dominant area: {title}",
                "category": "DIVERSIFICATION",
                "priority": "MEDIUM",
                "effort": "HIGH",
                "expected_benefit": "Medium - reduces concentration risk"
            }
        
        if "range" in insight_type.lower() and "sales" in domain.lower():
            return {
                "text": "Investigate causes of extreme values in performance metrics",
                "category": "ROOT_CAUSE_ANALYSIS",
                "priority": "MEDIUM",
                "effort": "HIGH",
                "expected_benefit": "Medium - identifies improvement opportunities"
            }
        
        return None
    
    @staticmethod
    def _assess_expected_impact(
        business_insights: List[Dict[str, Any]],
        confidence_level: str
    ) -> Dict[str, Any]:
        """Assess expected impact of acting on insights"""
        high_insights = sum(1 for i in business_insights if i.get("importance") == "HIGH")
        total_insights = len(business_insights)
        
        if total_insights == 0:
            return {
                "level": "LOW",
                "description": "No significant insights to drive impact",
                "factors": ["No actionable insights identified"]
            }
        
        # Calculate impact score
        impact_score = (high_insights / total_insights) * 100
        
        # Adjust for confidence
        if confidence_level == "HIGH":
            confidence_multiplier = 1.0
        elif confidence_level == "MEDIUM":
            confidence_multiplier = 0.7
        else:
            confidence_multiplier = 0.4
        
        adjusted_score = impact_score * confidence_multiplier
        
        # Determine impact level
        if adjusted_score >= 60:
            level = "HIGH"
            description = "Significant potential impact from acting on insights"
        elif adjusted_score >= 30:
            level = "MEDIUM"
            description = "Moderate potential impact from acting on insights"
        else:
            level = "LOW"
            description = "Limited potential impact from current insights"
        
        factors = []
        if high_insights > 0:
            factors.append(f"{high_insights} high-importance insights")
        factors.append(f"{confidence_level.lower()} confidence level")
        
        return {
            "level": level,
            "description": description,
            "score": round(adjusted_score, 2),
            "factors": factors
        }
    
    @staticmethod
    def _generate_explanation(
        recommendations: List[Dict[str, Any]],
        confidence_level: str,
        risk_level: str
    ) -> str:
        """Generate plain language explanation"""
        recommendation_count = len(recommendations)
        
        explanation_parts = []
        
        explanation_parts.append(
            f"Generated {recommendation_count} actionable recommendations based on data analysis."
        )
        
        if confidence_level == "HIGH":
            explanation_parts.append(
                "High confidence in the underlying data supports these recommendations."
            )
        elif confidence_level == "MEDIUM":
            explanation_parts.append(
                "Moderate confidence suggests these recommendations are reasonable but should be validated."
            )
        else:
            explanation_parts.append(
                "Low confidence indicates these recommendations should be treated as hypotheses for further testing."
            )
        
        if risk_level == "LOW":
            explanation_parts.append("Low risk associated with following these recommendations.")
        elif risk_level == "MEDIUM":
            explanation_parts.append("Moderate risk suggests careful implementation is advised.")
        else:
            explanation_parts.append("High risk requires cautious approach and pilot testing.")
        
        return " ".join(explanation_parts)
    
    @staticmethod
    def _generate_warnings(
        confidence_level: str,
        risk_level: str,
        limitations: List[str]
    ) -> List[str]:
        """Generate appropriate warnings"""
        warnings = []
        
        # Confidence-based warnings
        if confidence_level == "LOW":
            warnings.append("Low confidence in analysis - verify findings with additional data")
        
        # Risk-based warnings
        if risk_level == "HIGH":
            warnings.append("High risk of misleading conclusions - proceed with caution")
        elif risk_level == "MEDIUM":
            warnings.append("Moderate risk present - validate recommendations before full implementation")
        
        # Limitation-based warnings
        for limitation in limitations[:3]:  # Top 3 limitations
            if "No major limitations" not in limitation:
                warnings.append(limitation)
        
        # Always include at least one warning if none generated
        if not warnings:
            warnings.append("Standard business judgment should be applied to all recommendations")
        
        return warnings