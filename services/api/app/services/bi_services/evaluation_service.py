"""
Trust and Risk Evaluation Service
Evaluates confidence, risk, and stability of analysis results.
"""

from typing import Any, Dict, List, Optional


class EvaluationService:
    """Service for evaluating trust and risk of analytics"""
    
    @classmethod
    def evaluate_trust_risk(
        cls,
        quality_result: Dict[str, Any],
        analytics_result: Dict[str, Any],
        preprocessing_log: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Evaluate confidence, risk, and stability of results"""
        
        # Extract scores
        quality_score = quality_result.get("quality_score", 0)
        quality_level = quality_result.get("quality_level", "POOR")
        
        # Get analytics metrics
        analytics_tech = analytics_result.get("internal_technical", {})
        record_count = analytics_tech.get("record_count", 0)
        completeness = analytics_tech.get("data_quality_indicators", {}).get("completeness", 0)
        
        # Calculate confidence level
        confidence_score = cls._calculate_confidence_score(
            quality_score, record_count, completeness
        )
        confidence_level = cls._score_to_level(confidence_score)
        
        # Calculate risk level
        risk_score = cls._calculate_risk_score(
            quality_score, quality_level, preprocessing_log
        )
        risk_level = cls._score_to_level(risk_score, invert=True)  # Higher score = lower risk
        
        # Calculate stability score
        stability_score = cls._calculate_stability_score(
            record_count, completeness, quality_score
        )
        
        # Generate limitations
        limitations = cls._generate_limitations(
            quality_result, record_count, completeness, preprocessing_log
        )
        
        # Generate trust summary
        trust_summary = cls._generate_trust_summary(
            confidence_level, risk_level, stability_score, limitations
        )
        
        return {
            "confidence_score": round(confidence_score, 2),
            "confidence_level": confidence_level,
            "risk_score": round(risk_score, 2),
            "risk_level": risk_level,
            "stability_score": round(stability_score, 2),
            "stability_level": cls._score_to_level(stability_score),
            "limitations": limitations,
            "trust_summary": trust_summary,
            "evaluation_factors": {
                "data_quality": {
                    "score": quality_score,
                    "level": quality_level,
                    "weight": 0.4
                },
                "data_volume": {
                    "score": min(100, (record_count / 1000) * 100) if record_count > 0 else 0,
                    "level": cls._score_to_level(min(100, (record_count / 1000) * 100)),
                    "weight": 0.3
                },
                "data_completeness": {
                    "score": completeness * 100,
                    "level": cls._score_to_level(completeness * 100),
                    "weight": 0.3
                }
            }
        }
    
    @staticmethod
    def _calculate_confidence_score(
        quality_score: float,
        record_count: int,
        completeness: float
    ) -> float:
        """Calculate confidence score (0-100)"""
        # Weighted average of factors
        quality_weight = 0.4
        volume_weight = 0.3
        completeness_weight = 0.3
        
        # Volume score (more records = higher confidence, but diminishing returns)
        volume_score: float = 0.0
        if record_count >= 10000:
            volume_score = 100.0
        elif record_count >= 1000:
            volume_score = 80.0 + (record_count - 1000) / 9000.0 * 20.0
        elif record_count >= 100:
            volume_score = 50.0 + (record_count - 100) / 900.0 * 30.0
        elif record_count >= 10:
            volume_score = 20.0 + (record_count - 10) / 90.0 * 30.0
        else:
            volume_score = 0.0
        
        # Completeness score
        completeness_score = completeness * 100
        
        # Calculate weighted score
        confidence = (
            quality_score * quality_weight +
            volume_score * volume_weight +
            completeness_score * completeness_weight
        )
        
        return min(100, max(0, confidence))
    
    @staticmethod
    def _calculate_risk_score(
        quality_score: float,
        quality_level: str,
        preprocessing_log: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Calculate risk score (0-100, higher = lower risk)"""
        # Start with quality-based risk
        if quality_level == "EXCELLENT":
            base_risk = 20  # Low risk
        elif quality_level == "ACCEPTABLE":
            base_risk = 40  # Medium risk
        else:  # POOR
            base_risk = 70  # High risk
        
        # Adjust for preprocessing
        if preprocessing_log:
            # More preprocessing might indicate riskier data
            transformation_count = len([log for log in preprocessing_log 
                                      if "summary" not in log["step_name"]])
            risk_adjustment = min(20, transformation_count * 2)
            base_risk += risk_adjustment
        
        # Convert to risk score (inverse: higher score = lower risk)
        risk_score = 100 - min(100, base_risk)
        
        return risk_score
    
    @staticmethod
    def _calculate_stability_score(
        record_count: int,
        completeness: float,
        quality_score: float
    ) -> float:
        """Calculate stability score (0-100)"""
        # Stability considers consistency and reliability
        if record_count < 10:
            stability = quality_score * 0.5  # Very small samples are unstable
        elif record_count < 100:
            stability = quality_score * 0.7 + completeness * 100 * 0.3
        else:
            # Larger datasets can be more stable
            stability = quality_score * 0.5 + completeness * 100 * 0.3 + min(20, (record_count / 1000) * 20)
        
        return min(100, stability)
    
    @staticmethod
    def _score_to_level(score: float, invert: bool = False) -> str:
        """Convert score to level"""
        if invert:
            score = 100 - score
        
        if score >= 80:
            return "HIGH"
        elif score >= 60:
            return "MEDIUM"
        else:
            return "LOW"
    
    @staticmethod
    def _generate_limitations(
        quality_result: Dict[str, Any],
        record_count: int,
        completeness: float,
        preprocessing_log: Optional[List[Dict[str, Any]]] = None
    ) -> List[str]:
        """Generate plain language limitations"""
        limitations = []
        
        # Data volume limitations
        if record_count < 50:
            limitations.append("Analysis based on a small sample size, which may not be representative")
        elif record_count < 200:
            limitations.append("Moderate sample size; consider collecting more data for stronger conclusions")
        
        # Data quality limitations
        quality_level = quality_result.get("quality_level", "POOR")
        if quality_level == "POOR":
            limitations.append("Data quality is poor, which reduces reliability of insights")
        elif quality_level == "ACCEPTABLE":
            limitations.append("Data quality is acceptable but could be improved for more confident analysis")
        
        # Completeness limitations
        if completeness < 0.7:
            limitations.append("Significant missing data may affect analysis accuracy")
        elif completeness < 0.9:
            limitations.append("Some missing data present; results should be interpreted with caution")
        
        # Preprocessing limitations
        if preprocessing_log:
            transformation_count = len([log for log in preprocessing_log 
                                      if "summary" not in log["step_name"]])
            if transformation_count > 5:
                limitations.append("Extensive data cleaning was required, which may have introduced bias")
            elif transformation_count > 2:
                limitations.append("Moderate data cleaning performed; original data had quality issues")
        
        # Add quality-specific warnings
        warnings = quality_result.get("warnings", [])
        if warnings:
            limitation_count = len(warnings)
            limitations.append(f"Data quality assessment raised {limitation_count} warnings that may affect analysis")
        
        # If no specific limitations found
        if not limitations:
            limitations.append("No major limitations identified; results are reasonably reliable")
        
        return limitations
    
    @staticmethod
    def _generate_trust_summary(
        confidence_level: str,
        risk_level: str,
        stability_score: float,
        limitations: List[str]
    ) -> str:
        """Generate plain language trust summary"""
        parts = []
        
        # Confidence assessment
        if confidence_level == "HIGH":
            parts.append("High confidence in the analysis results")
        elif confidence_level == "MEDIUM":
            parts.append("Medium confidence in the analysis results")
        else:
            parts.append("Low confidence in the analysis results")
        
        # Risk assessment
        if risk_level == "LOW":
            parts.append("low risk of misleading conclusions")
        elif risk_level == "MEDIUM":
            parts.append("moderate risk of misleading conclusions")
        else:
            parts.append("high risk of misleading conclusions")
        
        # Stability assessment
        if stability_score >= 80:
            parts.append("results are stable and reliable")
        elif stability_score >= 60:
            parts.append("results are reasonably stable")
        else:
            parts.append("results may be unstable")
        
        # Limitations note
        if limitations and "No major limitations" not in limitations[0]:
            parts.append(f"considering {len(limitations)} identified limitations")
        
        return ". ".join(parts) + "."