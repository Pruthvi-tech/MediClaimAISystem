from fastapi import APIRouter, Depends
from database import get_db
from utils.dependencies import get_current_user, require_insurer

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary")
async def global_summary(user=Depends(get_current_user), db=Depends(get_db)):
    """Basic analytics – scoped by role."""
    match = {}
    if user["role"] == "user":
        match = {"user_email": user["email"]}
    elif user["role"] == "insurer":
        match = {"insurance_company": user.get("company_name")}

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }},
    ]
    cursor = db.claims.aggregate(pipeline)
    status_counts = {}
    async for doc in cursor:
        status_counts[doc["_id"]] = doc["count"]

    total = sum(status_counts.values())

    # Monthly trend (last 6 months)
    trend_pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 6},
    ]
    trend = []
    async for doc in db.claims.aggregate(trend_pipeline):
        trend.append({"month": doc["_id"], "count": doc["count"]})

    # Top insurance companies
    insurer_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$insurance_company", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    insurers = []
    async for doc in db.claims.aggregate(insurer_pipeline):
        insurers.append({"company": doc["_id"], "count": doc["count"]})

    return {
        "total": total,
        "by_status": status_counts,
        "monthly_trend": trend,
        "top_insurers": insurers,
    }