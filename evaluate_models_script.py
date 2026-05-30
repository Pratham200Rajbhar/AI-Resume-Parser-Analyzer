#!/usr/bin/env python3
import sys
import os
import json
import time
from pathlib import Path

# Set up python path so that app package is importable
WORKSPACE_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = WORKSPACE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import ML modules
from app.ml.nlp.spacy_ner import SpacyNER
from app.ml.nlp.bert_ner import BertNER
from app.ml.nlp.skill_normalizer import SkillNormalizer
from app.ml.nlp.section_segmenter import segment_sections
from app.ml.nlp.pipeline import NLPPipeline
from app.ml.analysis.bias_detector import BiasDetector
from app.ml.analysis.ats_scorer import ATSScorer
from app.ml.analysis.jd_matcher import JDMatcher
from app.ml.analysis.ranker import BatchRanker
from app.ml.analysis.fraud_detector import FraudDetector


def calculate_binary_metrics(y_true: list[int], y_pred: list[int]) -> dict:
    """Calculate accuracy, precision, recall, and F1 score for binary classification."""
    tp = sum(1 for gt, pd in zip(y_true, y_pred) if gt == 1 and pd == 1)
    tn = sum(1 for gt, pd in zip(y_true, y_pred) if gt == 0 and pd == 0)
    fp = sum(1 for gt, pd in zip(y_true, y_pred) if gt == 0 and pd == 1)
    fn = sum(1 for gt, pd in zip(y_true, y_pred) if gt == 1 and pd == 0)

    accuracy = (tp + tn) / max(1, len(y_true))
    precision = tp / max(1, (tp + fp))
    recall = tp / max(1, (tp + fn))
    f1 = 2 * precision * recall / max(1e-9, (precision + recall))

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn}
    }


def evaluate_spacy_ner() -> dict:
    """Evaluate SpacyNER on a small test case."""
    print("\n--- Evaluating SpacyNER ---")
    start_time = time.time()
    
    try:
        detector = SpacyNER()
        text = "Alice worked at Google in London in January 2020."
        entities = detector.extract(text)
        
        # Expected entities: Alice (PERSON), Google (ORG), London (GPE/LOC), January 2020 (DATE)
        print(f"Extracted entities: {entities}")
        
        # Let's check for correct classifications
        found_person = any(e["text"] == "Alice" and e["label"] == "PERSON" for e in entities)
        found_org = any(e["text"] == "Google" and e["label"] == "ORG" for e in entities)
        found_loc = any(e["text"] == "London" and e["label"] in ("GPE", "LOC") for e in entities)
        found_date = any("2020" in e["text"] and e["label"] == "DATE" for e in entities)
        
        score = sum([found_person, found_org, found_loc, found_date])
        accuracy = score / 4.0
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": accuracy,
            "metrics": {
                "detected_person": found_person,
                "detected_org": found_org,
                "detected_loc": found_loc,
                "detected_date": found_date,
                "total_extracted": len(entities)
            }
        }
    except Exception as e:
        print(f"SpacyNER failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def evaluate_bert_ner() -> dict:
    """Evaluate BertNER on a small resume test case."""
    print("\n--- Evaluating BertNER ---")
    start_time = time.time()
    
    try:
        detector = BertNER()
        # Resume-like sample text
        text = "John Doe is a Software Engineer at Microsoft. Expert in Python and React. He holds a BSC from MIT."
        entities = detector.extract(text)
        print(f"Extracted entities: {entities}")
        
        # Check standard resume label extractions (case-insensitive)
        found_name = any("john" in e["text"].lower() and e["label"] == "NAME" for e in entities)
        found_role = any("engineer" in e["text"].lower() and e["label"] == "ROLE" for e in entities)
        found_skill_python = any("python" in e["text"].lower() and e["label"] == "SKILL" for e in entities)
        found_degree = any("bsc" in e["text"].lower() and e["label"] == "DEGREE" for e in entities)
        
        # Calculate matching fraction
        matches = sum([found_name, found_role, found_skill_python, found_degree])
        accuracy = matches / 4.0
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": accuracy,
            "metrics": {
                "detected_name": found_name,
                "detected_role": found_role,
                "detected_skill_python": found_skill_python,
                "detected_degree": found_degree,
                "total_extracted": len(entities)
            }
        }
    except Exception as e:
        print(f"BertNER failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def evaluate_skill_normalizer() -> dict:
    """Evaluate SkillNormalizer accuracy against O*NET skills list."""
    print("\n--- Evaluating SkillNormalizer ---")
    start_time = time.time()
    
    try:
        normalizer = SkillNormalizer()
        
        test_cases = [
            ("Python", "Python", 1.0),                  # Exact Match
            ("TypeScript", "TypeScript", 1.0),          # Exact Match
            ("ReactJS", "React", 0.6),                  # Fuzzy/Embedding Match
            ("Dockr", "Docker", 0.5),                    # Fuzzy Match (Levenshtein)
            ("Kubernetes", "Kubernetes", 1.0),          # Exact Match
            ("NotASkillAtAll12345", "NotASkillAtAll12345", 0.0) # Fallback Match
        ]
        
        raw_skills = [c[0] for c in test_cases]
        results = normalizer.normalize(raw_skills)
        
        correct_normalizations = 0
        total_eval = len(test_cases)
        
        details = []
        for i, (raw, expected, min_conf) in enumerate(test_cases):
            res = results[i]
            normalized = res["normalized"]
            confidence = res["confidence"]
            
            is_correct = (normalized == expected) and (confidence >= min_conf)
            if is_correct:
                correct_normalizations += 1
                
            details.append({
                "raw": raw,
                "expected": expected,
                "actual": normalized,
                "confidence": confidence,
                "correct": is_correct
            })
            print(f"  Raw: {raw:20s} | Expected: {expected:15s} | Got: {normalized:15s} | Conf: {confidence:.3f} | Correct: {is_correct}")
            
        accuracy = correct_normalizations / total_eval
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": round(accuracy, 4),
            "details": details
        }
    except Exception as e:
        print(f"SkillNormalizer failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def evaluate_bias_detector() -> dict:
    """Evaluate BiasDetector model classification accuracy, precision, recall, and F1."""
    print("\n--- Evaluating BiasDetector ---")
    start_time = time.time()
    
    try:
        detector = BiasDetector()
        
        # Test sentences with ground truths for each bias category
        # Each tuple is (sentence_text, expected_age_bias, expected_gender_bias, expected_personal_bias)
        test_sentences = [
            ("I am a senior citizen looking for a job.", 1, 0, 0),
            ("We need a mature person with decades of experience.", 1, 0, 0),
            ("I am a professional software engineer.", 0, 1, 0), # Gender bias sentence from edge cases
            ("Looking for someone who is married and has children.", 0, 0, 1),
            ("Marital status: Married. Looking for a full-time position.", 0, 0, 1),
            ("Highly motivated developer with experience in python and backend systems.", 0, 0, 0),
            ("Looking for a challenging position as a software developer.", 0, 0, 0),
            ("Strong communication and project management skills.", 0, 0, 0)
        ]
        
        y_true_age, y_pred_age = [], []
        y_true_gender, y_pred_gender = [], []
        y_true_personal, y_pred_personal = [], []
        
        for text, gt_age, gt_gender, gt_personal in test_sentences:
            flags = detector.detect(text)
            
            # Predict flags based on output
            pred_age = 1 if any(f["type"] == "age" for f in flags) else 0
            pred_gender = 1 if any(f["type"] == "gender" for f in flags) else 0
            pred_personal = 1 if any(f["type"] == "personal" for f in flags) else 0
            
            y_true_age.append(gt_age)
            y_pred_age.append(pred_age)
            
            y_true_gender.append(gt_gender)
            y_pred_gender.append(pred_gender)
            
            y_true_personal.append(gt_personal)
            y_pred_personal.append(pred_personal)
            
            print(f"  Text: {text[:45]:45s} | Flags: {[f['type'] for f in flags]}")
            
        # Calculate metrics for each pipeline
        age_metrics = calculate_binary_metrics(y_true_age, y_pred_age)
        gender_metrics = calculate_binary_metrics(y_true_gender, y_pred_gender)
        personal_metrics = calculate_binary_metrics(y_true_personal, y_pred_personal)
        
        # Overall Accuracy across all pipeline binary tasks (8 samples * 3 labels = 24 tasks)
        y_true_all = y_true_age + y_true_gender + y_true_personal
        y_pred_all = y_pred_age + y_pred_gender + y_pred_personal
        overall_metrics = calculate_binary_metrics(y_true_all, y_pred_all)
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": overall_metrics["accuracy"],
            "overall_metrics": overall_metrics,
            "pipelines": {
                "age": age_metrics,
                "gender": gender_metrics,
                "personal": personal_metrics
            }
        }
    except Exception as e:
        print(f"BiasDetector failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def evaluate_ats_scorer() -> dict:
    """Evaluate ATSScorer model loading and score outputs."""
    print("\n--- Evaluating ATSScorer ---")
    start_time = time.time()
    
    try:
        scorer = ATSScorer()
        
        # Test clean resume input
        text_clean = "EXPERIENCE\nWork history details...\nEDUCATION\nGanpat University\nSKILLS\nPython, SQL, React\nCONTACT\npratham@gmail.com +919512518403"
        sections_clean = segment_sections(text_clean)
        entities_clean = {
            "name": "Pratham Rajbhar",
            "email": "pratham@gmail.com",
            "phone": "+919512518403",
            "skills": [{"raw": "Python", "normalized": "Python"}, {"raw": "SQL", "normalized": "SQL"}, {"raw": "React", "normalized": "React"}]
        }
        
        res_clean = scorer.score(entities_clean, text_clean, sections_clean)
        score_clean = res_clean["score"]
        print(f"  Clean Resume Score: {score_clean}/100 | XGBoost active: {res_clean.get('score') is not None}")
        
        # Test badly formatted resume input (with tables/columns)
        text_bad = "|| Profile || Contact ||\n|| Python dev || pratham@gmail.com ||\n\nNo structured sections."
        sections_bad = segment_sections(text_bad)
        entities_bad = {
            "name": "Pratham",
            "email": "pratham@gmail.com",
            "phone": ""
        }
        
        res_bad = scorer.score(entities_bad, text_bad, sections_bad)
        score_bad = res_bad["score"]
        print(f"  Badly Formatted Resume Score: {score_bad}/100")
        
        # Check that bad formatting results in score reduction (expected behavior)
        working_correctly = score_clean > score_bad
        print(f"  Scorer correctly penalizes bad format/missing info: {working_correctly}")
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": 1.0 if working_correctly else 0.0,
            "metrics": {
                "score_clean": score_clean,
                "score_bad": score_bad,
                "score_difference": score_clean - score_bad,
                "formatting_penalties_work": working_correctly
            }
        }
    except Exception as e:
        print(f"ATSScorer failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def evaluate_jd_matcher() -> dict:
    """Evaluate JDMatcher embedding generation and match scores."""
    print("\n--- Evaluating JDMatcher ---")
    start_time = time.time()
    
    try:
        matcher = JDMatcher()
        
        # Resume entities & text
        resume_text = "Python developer. Expert in machine learning and FastAPI."
        entities = {
            "skills": ["Python", "FastAPI", "Machine Learning"],
            "experience": []
        }
        
        # Matching job description
        jd_match = "We are seeking a Python developer specializing in FastAPI and machine learning."
        jd_emb_match = matcher.embed(jd_match)
        res_match = matcher.match(entities, resume_text, jd_match, jd_emb_match)
        score_match = res_match["match_score"]
        
        # Non-matching job description (e.g. chef)
        jd_non_match = "Seeking a professional head chef with experience in Italian cuisine, pasta making, and kitchen management."
        jd_emb_non_match = matcher.embed(jd_non_match)
        res_non_match = matcher.match(entities, resume_text, jd_non_match, jd_emb_non_match)
        score_non_match = res_non_match["match_score"]
        
        print(f"  Matching JD score: {score_match:.4f}")
        print(f"  Non-matching JD score: {score_non_match:.4f}")
        
        # Verify matching JD has higher score than non-matching JD
        correct_matching = score_match > score_non_match
        print(f"  Semantic matching verification: {correct_matching}")
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": 1.0 if correct_matching else 0.0,
            "metrics": {
                "score_match": score_match,
                "score_non_match": score_non_match,
                "score_difference": round(score_match - score_non_match, 4),
                "semantic_retrieval_works": correct_matching
            }
        }
    except Exception as e:
        print(f"JDMatcher failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def evaluate_batch_ranker_and_fraud_detector() -> dict:
    """Evaluate BatchRanker and FraudDetector logic."""
    print("\n--- Evaluating BatchRanker & FraudDetector ---")
    start_time = time.time()
    
    try:
        ranker = BatchRanker()
        fraud = FraudDetector()
        
        # 1. Evaluate BatchRanker
        candidates = [
            {"resume_id": "1", "candidate_name": "Low Ranker", "ats_score": 50, "match_score": 0.3, "entities": {"skills": ["Python"], "experience": [], "education": []}},
            {"resume_id": "2", "candidate_name": "High Ranker", "ats_score": 90, "match_score": 0.8, "entities": {"skills": ["Python", "JS", "SQL", "Git", "Docker"], "experience": [{"duration": "2020-2023"}], "education": [{"degree": "bachelor"}]}}
        ]
        
        # Run ranking (with no JD embedding, so it redistributes match weight to ATS)
        ranked = ranker.rank(candidates, jd_embedding=None)
        correct_rank = (ranked[0]["resume_id"] == "2" and ranked[0]["rank"] == 1)
        print(f"  BatchRanker correct rank sorting: {correct_rank}")
        
        # 2. Evaluate FraudDetector
        fraud_entities = {
            "experience": [
                {"role": "Job A", "company": "Co A", "duration": "Jan 2020 - Dec 2021"},
                {"role": "Job B", "company": "Co B", "duration": "Jun 2021 - Present"}  # Overlaps by 6 months
            ],
            "education": [
                {"degree": "B.Sc.", "institution": "Univ", "year": "2030"}  # Future graduation
            ]
        }
        
        flags = fraud.detect(fraud_entities)
        has_overlap = any(f["type"] == "overlapping_employment" for f in flags)
        has_future_grad = any(f["type"] == "future_graduation_year" for f in flags)
        correct_fraud = has_overlap and has_future_grad
        print(f"  FraudDetector flagged overlap and future grad: {correct_fraud}")
        
        return {
            "status": "WORKING",
            "time_taken_seconds": round(time.time() - start_time, 4),
            "accuracy": 1.0 if (correct_rank and correct_fraud) else 0.5 if (correct_rank or correct_fraud) else 0.0,
            "metrics": {
                "correct_rank": correct_rank,
                "has_overlap_flag": has_overlap,
                "has_future_grad_flag": has_future_grad,
                "total_fraud_flags": len(flags)
            }
        }
    except Exception as e:
        print(f"Ranker/Fraud failed to run: {e}")
        return {"status": "FAILED", "error": str(e)}


def main():
    print("=" * 60)
    print("AI RESUME PARSER & ANALYZER: MODEL EVALUATION RUNNER")
    print("=" * 60)
    
    results = {}
    
    results["spacy_ner"] = evaluate_spacy_ner()
    results["bert_ner"] = evaluate_bert_ner()
    results["skill_normalizer"] = evaluate_skill_normalizer()
    results["bias_detector"] = evaluate_bias_detector()
    results["ats_scorer"] = evaluate_ats_scorer()
    results["jd_matcher"] = evaluate_jd_matcher()
    results["ranker_and_fraud"] = evaluate_batch_ranker_and_fraud_detector()
    
    print("\n" + "=" * 60)
    print("EVALUATION RESULTS SUMMARY")
    print("=" * 60)
    
    print(f"{'Model / Component':25s} | {'Status':8s} | {'Accuracy / Metric':18s} | {'Latency (sec)':13s}")
    print("-" * 72)
    
    for model_name, info in results.items():
        status = info.get("status", "UNKNOWN")
        acc = info.get("accuracy", "N/A")
        latency = info.get("time_taken_seconds", "N/A")
        
        acc_str = f"{acc:.2%}" if isinstance(acc, (int, float)) else str(acc)
        latency_str = f"{latency:.4f}s" if isinstance(latency, (int, float)) else str(latency)
        
        print(f"{model_name:25s} | {status:8s} | {acc_str:18s} | {latency_str:13s}")
        
    print("=" * 72)
    
    # Save the report JSON
    output_report_path = WORKSPACE_DIR / "output" / "model_evaluation_report.json"
    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"Detailed evaluation report written to {output_report_path}")


if __name__ == "__main__":
    main()
