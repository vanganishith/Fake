import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.crop_planning_service import generate_crop_planning_recommendations

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Crop Planning"])


class CropPlanningRequest(BaseModel):
    land_area_acres: float = Field(
        ...,
        ge=0.5,
        le=100.0,
        description="Land area in acres (minimum 0.5, maximum 100)"
    )
    soil_type: str = Field(
        ...,
        pattern="^(BLACK|RED)$",
        description="Soil type: 'BLACK' or 'RED'"
    )
    latitude: Optional[float] = Field(
        None,
        description="GPS latitude of the farm land"
    )
    longitude: Optional[float] = Field(
        None,
        description="GPS longitude of the farm land"
    )
    language: Optional[str] = Field(
        "en",
        description="Preferred language code ('te', 'hi', 'en', 'ta', 'kn')"
    )


@router.post(
    "/crop-planning/recommend",
    summary="Get AI-Assisted Crop Planning Recommendations",
    description="Generates top 3-5 tailored crop recommendations with whole-farm investment/return calculations and verified government schemes based on land area, soil, location, and season.",
)
async def recommend_crops(payload: CropPlanningRequest):
    try:
        result = await generate_crop_planning_recommendations(
            land_area_acres=payload.land_area_acres,
            soil_type=payload.soil_type,
            latitude=payload.latitude,
            longitude=payload.longitude,
            language=payload.language or "en"
        )
        return result
    except ValueError as ve:
        logger.warning(f"[CropPlanning API] Validation error: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": str(ve)}
        )
    except Exception as e:
        logger.error(f"[CropPlanning API] Error processing recommendation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": f"Failed to generate crop recommendations: {str(e)}"}
        )
