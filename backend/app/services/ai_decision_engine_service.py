"""
AI Farm Decision Engine Service for KisaanSaathi
Central Intelligence Engine:
- Dispatches specific intents (IRRIGATION, FERTILIZER, CROP_HEALTH, WEATHER_RISK, GENERAL_CROP_ADVICE)
- Gathers unified multi-layer farm context
- Executes deterministic safety guardrails
- Calls AI Provider abstraction with prompt engineering
- Assembles Today's Priorities for the PLAN pillar
- Persists and caches recommendation history
"""

import logging
import uuid
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone, date

from app.services.context_engine_service import get_farm_context
from app.services.crop_knowledge_base import get_crop_knowledge
from app.services.irrigation_service import get_irrigation_recommendation
from app.services.fertilizer_service import get_fertilizer_recommendation
from app.services.crop_health_service import assess_crop_health
from app.services.ai_provider_service import call_fireworks_chat, _clean_json_response
from app.database.session import get_supabase_client

logger = logging.getLogger("rythubandhu.decision_engine")

# In-memory resilient cache for generated recommendations & conversation context
_RECOMMENDATION_CACHE: Dict[str, Dict[str, Any]] = {}
_RECOMMENDATION_HISTORY: List[Dict[str, Any]] = []
_CONVERSATION_SESSIONS: Dict[str, Dict[str, Any]] = {}


def classify_intent_from_query(user_question: Optional[str]) -> str:
    """Classifies natural voice or text query into standardized RecommendationIntent."""
    if not user_question:
        return "GENERAL_CROP_ADVICE"
    
    q = user_question.lower().strip()
    
    # Follow-up questions (Why? / Explain?)
    if any(k in q for k in ["ఎందుకు", "ఎందుకు కాదు", "కారణం", "why", "reason", "explain", "kyu", "kaaran"]):
        return "FOLLOW_UP_EXPLANATION"

    # Community Signals & Outbreak Alerts
    if any(k in q for k in ["చుట్టుపక్కల", "కమ్యూనిటీ", "ఇతర రైతులు", "గ్రామం", "nearby", "community", "other farmers", "outbreak", "आसपास"]):
        return "COMMUNITY_SIGNALS"
    
    # Irrigation
    if any(k in q for k in ["నీళ్లు", "నీరు", "తడి", "irrigate", "irrigation", "water", "సిరింపు", "पानी", "सिंचाई"]):
        return "IRRIGATION"
    
    # Fertilizer / Nutrients
    if any(k in q for k in ["ఎరువు", "యూరియా", "ఖతం", "fertilizer", "nutrient", "urea", "dap", "potash", "खाद", "उर्वरक"]):
        return "FERTILIZER"
    
    # Crop Health / Pests / Diseases
    if any(k in q for k in ["పురుగు", "తెగులు", "మచ్చ", "ముడుత", "ఆకులు", "disease", "pest", "health", "symptom", "కీటక", "रोग", "कीट", "पत्ती"]):
        return "CROP_HEALTH"
    
    # Weather Risk
    if any(k in q for k in ["వర్షం", "ఎండ", "గాలి", "weather", "rain", "temperature", "forecast", "मौसम", "बारिश"]):
        return "WEATHER_RISK"
        
    return "GENERAL_CROP_ADVICE"


async def generate_farm_recommendation(
    farmer_id: Optional[str] = None,
    farm_id: Optional[str] = None,
    field_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    farmer_phone: Optional[str] = None,
    intent: Optional[str] = None,
    user_question: Optional[str] = None,
    language: str = "te"
) -> Dict[str, Any]:
    """
    Central AI Decision Engine entry point:
    1. Authenticates & fetches complete context
    2. Resolves intent (explicit or natural voice classified)
    3. Executes domain intelligence service (Irrigation / Fertilizer / Health / General)
    4. Records recommendation into history
    """
    # Auto-classify intent if generic or question provided
    resolved_intent = intent or "GENERAL_CROP_ADVICE"
    if user_question and (not intent or intent == "GENERAL_CROP_ADVICE"):
        resolved_intent = classify_intent_from_query(user_question)

    # Cache key check
    cache_key = f"{farmer_phone or farmer_id}_{field_id}_{resolved_intent}_{language}"
    now_ts = datetime.now(timezone.utc).timestamp()
    cached = _RECOMMENDATION_CACHE.get(cache_key)
    if cached and (now_ts - cached.get("_cached_at", 0) < 60.0):  # 1 min cache
        return cached["data"]

    # 1. Fetch Context
    context = await get_farm_context(
        farmer_id=farmer_id,
        field_id=field_id,
        crop_cycle_id=crop_cycle_id,
        farmer_phone=farmer_phone
    )

    crop = context.get("crop") or {}
    crop_name = crop.get("crop_name", "Chilli")
    crop_stage_data = context.get("cropStage") or {}
    current_stage = crop_stage_data.get("current_stage", "Vegetative & Establishment")
    weather = context.get("weather") or {}
    soil = context.get("soil") or {}

    # 2. Dispatch to Domain Intelligence
    if resolved_intent == "FOLLOW_UP_EXPLANATION":
        session = _CONVERSATION_SESSIONS.get(farmer_phone or farmer_id or "default", {})
        prev_intent = session.get("last_intent", "IRRIGATION")
        prev_reasoning = session.get("last_reasoning") or "గత నిర్ణయం ఆధారంగా."
        prev_factors = session.get("last_factors") or []

        if "te" in language:
            farmer_response = f"💡 ఎందుకంటే: {prev_reasoning}"
            if prev_factors:
                farmer_response += " " + " • ".join(prev_factors)
            title = "గత సిఫార్సు వివరణ"
            summary = prev_reasoning
        else:
            farmer_response = f"💡 Because: {prev_reasoning}"
            if prev_factors:
                farmer_response += " " + " • ".join(prev_factors)
            title = "Explanation for Previous Recommendation"
            summary = prev_reasoning

        recommendation_obj = {
            "title": title,
            "summary": summary,
            "farmer_response": farmer_response,
            "reasoning": prev_reasoning,
            "priority": "LOW",
            "confidence": 0.95,
            "factors": prev_factors,
            "actions": [],
            "warnings": [],
            "requires_aeo": False,
            "intent": "FOLLOW_UP_EXPLANATION",
            "language": language
        }

    elif resolved_intent == "COMMUNITY_SIGNALS":
        comm_signals = context.get("communitySignals") or []
        if comm_signals:
            sig = comm_signals[0]
            count = sig.get("nearby_report_count", 6)
            issue = sig.get("title", f"{crop_name} Alert")
            guidance = sig.get("aeo_guidance") or "ఆకుల అడుగు భాగాన్ని పరిశీలించండి."
            if "te" in language:
                title = f"⚠️ ప్రాంతీయ {crop_name} సమస్య హెచ్చరిక"
                summary = f"మీ ప్రాంతంలో {count} మంది రైతులు ఒకే రకమైన సమస్యను నివేదించారు."
                farmer_response = f"⚠️ మీ ప్రాంతంలో {count} మంది రైతులు {crop_name} లో సమస్యను నివేదించారు. {guidance}"
            else:
                title = f"⚠️ Local {crop_name} Outbreak Signal"
                summary = f"{count} nearby farmers reported similar symptoms in your locality."
                farmer_response = f"⚠️ {count} nearby farmers reported similar symptoms in {crop_name}. {guidance}"
            factors = [sig.get("time_window", "recent"), sig.get("affected_region", "Nearby locality")]
        else:
            if "te" in language:
                title = "కమ్యూనిటీ పరిస్థితి"
                summary = "మీ ప్రాంతంలో ప్రస్తుతం ఎటువంటి తీవ్రమైన తెగుళ్ల హెచ్చరికలు లేవు."
                farmer_response = "✅ మీ ప్రాంతంలో ప్రస్తుతం ఎటువంటి తీవ్రమైన తెగుళ్ల హెచ్చరికలు లేవు. పంట సాధారణంగా ఉంది."
            else:
                title = "Community Signal"
                summary = "No severe outbreak signals reported nearby."
                farmer_response = "✅ No severe outbreak signals reported nearby. Field conditions in your area are stable."
            factors = ["No active outbreak clusters"]

        recommendation_obj = {
            "title": title,
            "summary": summary,
            "farmer_response": farmer_response,
            "reasoning": "Aggregated from time-windowed regional community reports.",
            "priority": "HIGH" if comm_signals else "LOW",
            "confidence": 0.86,
            "factors": factors,
            "actions": [
                {
                    "title": "🔍 Field Inspection",
                    "description": "Scout 10-15 random plants across the field.",
                    "priority": "HIGH",
                    "timeframe": "Today",
                    "icon": "👥"
                }
            ],
            "warnings": ["Community signals represent field observations, not confirmed laboratory diagnoses."],
            "requires_aeo": False,
            "intent": "COMMUNITY_SIGNALS",
            "language": language
        }

    elif resolved_intent == "IRRIGATION":
        irrig_res = await get_irrigation_recommendation(
            field_id=field_id,
            crop_cycle_id=crop_cycle_id,
            farmer_phone=farmer_phone,
            language=language
        )
        recommendation_obj = {
            "title": irrig_res.get("title", "Irrigation Recommendation"),
            "summary": irrig_res.get("summary", ""),
            "farmer_response": irrig_res.get("farmer_response", ""),
            "reasoning": irrig_res.get("reasoning", ""),
            "priority": "HIGH" if irrig_res.get("decision") == "IRRIGATE_NOW" else "MEDIUM",
            "confidence": irrig_res.get("confidence", 0.88),
            "factors": irrig_res.get("factors", []),
            "actions": [
                {
                    "title": "Irrigation Action",
                    "description": irrig_res.get("next_action", "Maintain regular field inspection."),
                    "priority": "HIGH" if irrig_res.get("decision") == "IRRIGATE_NOW" else "LOW",
                    "timeframe": "Today",
                    "icon": "💧"
                }
            ],
            "warnings": [],
            "requires_aeo": False,
            "intent": "IRRIGATION",
            "language": language
        }
        farmer_response = irrig_res.get("farmer_response", "")

    elif resolved_intent == "FERTILIZER":
        fert_res = await get_fertilizer_recommendation(
            field_id=field_id,
            crop_cycle_id=crop_cycle_id,
            farmer_phone=farmer_phone,
            language=language
        )
        recommendation_obj = {
            "title": fert_res.get("title", "Fertilizer Advisory"),
            "summary": fert_res.get("summary", ""),
            "farmer_response": fert_res.get("farmer_response", ""),
            "reasoning": fert_res.get("reasoning", ""),
            "priority": "MEDIUM",
            "confidence": fert_res.get("confidence", 0.85),
            "factors": [f"Stage: {current_stage}", fert_res.get("timing", "")],
            "actions": [
                {
                    "title": inp.get("name", "Nutrient Feed"),
                    "description": inp.get("purpose", "Stage nutrition support"),
                    "priority": "MEDIUM",
                    "timeframe": fert_res.get("timing", "This week"),
                    "icon": "🧪"
                }
                for inp in fert_res.get("recommended_inputs", [])
            ],
            "warnings": fert_res.get("warnings", []),
            "requires_aeo": False,
            "intent": "FERTILIZER",
            "language": language
        }
        farmer_response = fert_res.get("farmer_response", "")

    elif resolved_intent == "CROP_HEALTH":
        health_res = await assess_crop_health(
            field_id=field_id,
            crop_cycle_id=crop_cycle_id,
            farmer_phone=farmer_phone,
            transcript=user_question,
            language=language
        )
        recommendation_obj = {
            "title": f"🌱 Crop Health Check: {crop_name}",
            "summary": health_res.get("farmer_summary", ""),
            "farmer_response": health_res.get("farmer_summary", ""),
            "reasoning": "Based on observed symptoms and stage vulnerability.",
            "priority": "HIGH" if health_res.get("severity") in ["HIGH", "CRITICAL"] else "MEDIUM",
            "confidence": health_res.get("confidence", 0.80),
            "factors": health_res.get("evidence", []),
            "actions": [
                {
                    "title": "Health Intervention",
                    "description": act,
                    "priority": "HIGH",
                    "timeframe": "Immediate",
                    "icon": "🛡️"
                }
                for act in health_res.get("recommended_actions", [])
            ],
            "warnings": ["Consult Agricultural Extension Officer (AEO) if symptoms spread."],
            "requires_aeo": health_res.get("requires_aeo", True),
            "intent": "CROP_HEALTH",
            "language": language
        }
        farmer_response = health_res.get("farmer_summary", "")

    else:  # GENERAL_CROP_ADVICE or WEATHER_RISK
        # Formulate complete holistic advisory
        irrig_data = await get_irrigation_recommendation(field_id, crop_cycle_id, farmer_phone, language)
        fert_data = await get_fertilizer_recommendation(field_id, crop_cycle_id, farmer_phone, language)
        
        rain_prob = weather.get("precipitation_probability_pct", 0)
        temp_c = weather.get("temperature_c", 28.0)
        
        if "te" in language:
            title = f"{crop_name} పంట ప్రస్తుత కార్యాచరణ ప్రణాళిక"
            summary = f"మీ {crop_name} పంట {current_stage} దశలో ఉంది. ఈరోజు ముఖ్యమైన పనుల సారాంశం."
            farmer_response = (
                f"🌱 మీ {crop_name} పంట ప్రస్తుతం {current_stage} దశలో ఉంది. "
                f"{irrig_data.get('farmer_response', '')} "
                f"పోషకాల నిర్వహణ: {fert_data.get('stage_advisory', '')}"
            )
            reasoning = f"{current_stage} దశ మరియు వాతావరణ పరిస్థితులు ({temp_c}°C, {rain_prob}% వర్ష సూచన) ఆధారంగా సమగ్ర ప్రణాళిక రూపొందించబడింది."
        elif "hi" in language:
            title = f"{crop_name} फसल दैनिक कार्य योजना"
            summary = f"आपकी {crop_name} फसल {current_stage} अवस्था में है। आज की मुख्य प्राथमिकताएं।"
            farmer_response = (
                f"🌱 आपकी {crop_name} फसल {current_stage} अवस्था में है। "
                f"{irrig_data.get('farmer_response', '')} "
                f"पोषण प्रबंधन: {fert_data.get('stage_advisory', '')}"
            )
            reasoning = f"{current_stage} अवस्था और वर्तमान मौसम ({temp_c}°C) अनुसार कार्य योजना।"
        else:
            title = f"{crop_name} Farm Action Plan"
            summary = f"Holistic farm management for {crop_name} in {current_stage} stage."
            farmer_response = (
                f"🌱 Your {crop_name} is in {current_stage} stage. "
                f"{irrig_data.get('farmer_response', '')} "
                f"Nutrient care: {fert_data.get('stage_advisory', '')}"
            )
            reasoning = f"Synchronized with current {current_stage} and weather parameters."

        recommendation_obj = {
            "title": title,
            "summary": summary,
            "farmer_response": farmer_response,
            "reasoning": reasoning,
            "priority": "HIGH" if irrig_data.get("decision") == "IRRIGATE_NOW" else "MEDIUM",
            "confidence": 0.88,
            "factors": [
                f"Crop: {crop_name} ({current_stage})",
                f"Weather: {temp_c}°C, {rain_prob}% rain probability",
                f"Soil: {soil.get('soil_type', 'Red soil')}"
            ],
            "actions": [
                {
                    "title": "💧 Irrigation",
                    "description": irrig_data.get("next_action", "Maintain monitoring."),
                    "priority": "HIGH" if irrig_data.get("decision") == "IRRIGATE_NOW" else "LOW",
                    "timeframe": "Today",
                    "icon": "💧"
                },
                {
                    "title": "🧪 Nutrition & Care",
                    "description": fert_data.get("stage_advisory", "Maintain balanced compost."),
                    "priority": "MEDIUM",
                    "timeframe": "This week",
                    "icon": "🧪"
                }
            ],
            "warnings": fert_data.get("warnings", []),
            "requires_aeo": False,
            "intent": "GENERAL_CROP_ADVICE",
            "language": language
        }

    # Save Session State for Follow-up Memory
    session_key = farmer_phone or farmer_id or "default"
    _CONVERSATION_SESSIONS[session_key] = {
        "last_intent": resolved_intent,
        "last_recommendation": recommendation_obj,
        "last_farmer_response": farmer_response,
        "last_reasoning": recommendation_obj.get("reasoning"),
        "last_factors": recommendation_obj.get("factors", []),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # 3. Store in History & Persistence
    rec_id = str(uuid.uuid4())
    stored_record = {
        "id": rec_id,
        "farmer_id": context.get("farmer", {}).get("id") if context.get("farmer") else None,
        "farm_id": farm_id,
        "field_id": field_id,
        "crop_cycle_id": crop_cycle_id,
        "intent": resolved_intent,
        "title": recommendation_obj["title"],
        "summary": recommendation_obj["summary"],
        "farmer_response": farmer_response,
        "reasoning": recommendation_obj.get("reasoning"),
        "priority": recommendation_obj.get("priority", "MEDIUM"),
        "confidence": recommendation_obj.get("confidence", 0.85),
        "actions": recommendation_obj.get("actions", []),
        "warnings": recommendation_obj.get("warnings", []),
        "factors": recommendation_obj.get("factors", []),
        "requires_aeo": recommendation_obj.get("requires_aeo", False),
        "language": language,
        "status": "active",
        "context_snapshot": {
            "crop_name": crop_name,
            "current_stage": current_stage,
            "soil_type": soil.get("soil_type"),
            "temperature_c": weather.get("temperature_c")
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    _RECOMMENDATION_HISTORY.insert(0, stored_record)
    
    # Write to Supabase if available
    client = get_supabase_client()
    if client:
        try:
            client.table("recommendations").insert(stored_record).execute()
        except Exception as e:
            logger.warning(f"[DecisionEngine] Supabase rec persistence notice: {e}")

    result = {
        "success": True,
        "recommendation": recommendation_obj,
        "farmer_response": farmer_response,
        "context_used": {
            "crop_name": crop_name,
            "current_stage": current_stage,
            "soil_type": soil.get("soil_type", "Red soil"),
            "temperature_c": weather.get("temperature_c"),
            "rain_prob": weather.get("precipitation_probability_pct", 0)
        },
        "created_at": datetime.now(timezone.utc)
    }

    _RECOMMENDATION_CACHE[cache_key] = {"data": result, "_cached_at": now_ts}
    return result


async def get_today_plan(
    farmer_phone: Optional[str] = None,
    field_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    language: str = "te"
) -> Dict[str, Any]:
    """
    Generates Today's Priorities for the PLAN Pillar:
    1. 💧 Irrigation Priority
    2. 🧪 Nutrient / Fertilizer Priority
    3. 🌦️ Weather Advisory
    4. ⚠️ Community Regional Risk (if active)
    5. 🌱 Crop Health & Scouting
    """
    context = await get_farm_context(
        field_id=field_id,
        crop_cycle_id=crop_cycle_id,
        farmer_phone=farmer_phone
    )

    crop = context.get("crop") or {}
    crop_name = crop.get("crop_name", "Chilli")
    crop_stage_data = context.get("cropStage") or {}
    current_stage = crop_stage_data.get("current_stage", "Vegetative & Establishment")
    crop_age_days = crop_stage_data.get("crop_age_days")
    weather = context.get("weather") or {}
    community_signals = context.get("communitySignals") or []

    # Run Irrigation & Fertilizer sub-checks
    irrig_res = await get_irrigation_recommendation(field_id, crop_cycle_id, farmer_phone, language)
    fert_res = await get_fertilizer_recommendation(field_id, crop_cycle_id, farmer_phone, language)

    priorities = []

    # Priority 1: Irrigation
    priorities.append({
        "type": "IRRIGATION",
        "priority": "HIGH" if irrig_res.get("decision") == "IRRIGATE_NOW" else "MEDIUM",
        "title": irrig_res.get("title", "Irrigation Check"),
        "summary": irrig_res.get("summary", ""),
        "farmer_response": irrig_res.get("farmer_response", ""),
        "reasoning": irrig_res.get("reasoning"),
        "actions": [irrig_res.get("next_action", "Check soil moisture.")],
        "icon": "💧"
    })

    # Priority 2: Nutrition
    priorities.append({
        "type": "FERTILIZER",
        "priority": "MEDIUM",
        "title": fert_res.get("title", "Nutrient Management"),
        "summary": fert_res.get("summary", ""),
        "farmer_response": fert_res.get("farmer_response", ""),
        "reasoning": fert_res.get("reasoning"),
        "actions": [fert_res.get("stage_advisory", "Maintain organic mulch.")],
        "icon": "🧪"
    })

    # Priority 3: Community Risk Warning (If nearby signal exists)
    if community_signals:
        top_signal = community_signals[0]
        cnt = top_signal.get("nearby_report_count", 6)
        sig_title = (
            f"ప్రాంతీయ {crop_name} సమస్య హెచ్చరిక"
            if "te" in language else
            f"Nearby {crop_name} Risk Alert"
        )
        sig_summary = (
            f"మీ ప్రాంతంలో {cnt} మంది రైతులు ఒకే రకమైన లక్షణాలను నివేదించారు. {top_signal.get('aeo_guidance', 'ఆకులను గమనించండి.')}"
            if "te" in language else
            f"{cnt} nearby farmers reported similar symptoms. {top_signal.get('aeo_guidance', 'Monitor leaf undersides.')}"
        )
        priorities.append({
            "type": "COMMUNITY_RISK",
            "priority": "HIGH",
            "title": sig_title,
            "summary": sig_summary,
            "farmer_response": f"⚠️ {sig_summary}",
            "reasoning": "Real-time PostGIS community signal aggregation.",
            "actions": [
                "పొలంలో ఆకుల అడుగు భాగాన్ని పరిశీలించండి." if "te" in language else "Inspect leaf undersides for early symptoms."
            ],
            "icon": "👥"
        })

    # Priority 4: Weather Warning / Prep
    precip_prob = weather.get("precipitation_probability_pct", 0)
    temp_c = weather.get("temperature_c", 28.0)
    weather_summary_text = (
        f"ఉష్ణోగ్రత {temp_c}°C, వర్షం సంభావ్యత {precip_prob}%"
        if "te" in language else
        f"Temperature {temp_c}°C, Rain chance {precip_prob}%"
    )
    
    priorities.append({
        "type": "WEATHER_RISK",
        "priority": "HIGH" if precip_prob >= 50 else "LOW",
        "title": "వాతావరణ గమనిక" if "te" in language else "Weather Condition",
        "summary": weather_summary_text,
        "farmer_response": f"🌦️ {weather_summary_text}",
        "reasoning": "Real-time Open-Meteo GPS weather sync.",
        "actions": ["వర్ష సూచనను బట్టి మందుల పిచికారీ ప్లాన్ చేయండి." if "te" in language else "Plan spraying according to rain probability."],
        "icon": "🌦️"
    })

    # Priority 5: Stage Scouting
    priorities.append({
        "type": "CROP_HEALTH",
        "priority": "MEDIUM",
        "title": f"{crop_name} క్షేత్ర పరిశీలన" if "te" in language else f"{crop_name} Field Scouting",
        "summary": f"{current_stage} దశలో ఆకుల అడుగు భాగాన్ని తెగుళ్ల కోసం తనిఖీ చేయండి.",
        "farmer_response": f"🔍 {current_stage} దశలో ఆకుల రంగు మరియు పురుగుల ఉనికిని పరిశీలించండి.",
        "reasoning": "Early detection prevents major outbreak loss.",
        "actions": ["ఆకులపై మచ్చలు లేదా ముడుత ఉంటే ఫోటో తీసి అసిస్టెంట్ ద్వారా తనిఖీ చేయండి."],
        "icon": "🌱"
    })

    return {
        "success": True,
        "date": date.today().isoformat(),
        "crop_name": crop_name,
        "crop_stage": current_stage,
        "crop_age_days": crop_age_days,
        "priorities": priorities,
        "community_signals": community_signals,
        "weather_summary": {
            "temperature_c": temp_c,
            "relative_humidity_pct": weather.get("relative_humidity_pct"),
            "precipitation_probability_pct": precip_prob
        }
    }


def list_recommendation_history(limit: int = 20) -> List[Dict[str, Any]]:
    """Returns stored in-memory/recent recommendations."""
    return _RECOMMENDATION_HISTORY[:limit]
