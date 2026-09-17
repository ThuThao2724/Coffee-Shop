from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prophet import Prophet
import pandas as pd
from typing import List, Optional
import logging

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

app = FastAPI(title="Coffee Shop Forecast Service", version="1.0.0")


class RevenuePoint(BaseModel):
    date: str
    revenue: float


class ForecastRequest(BaseModel):
    branch_id: Optional[str] = None
    history: List[RevenuePoint]
    periods: int = 30
    freq: str = "D"
    holidays: Optional[List[str]] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/forecast")
def forecast(req: ForecastRequest):
    if len(req.history) < 14:
        raise HTTPException(
            status_code=400,
            detail="Can toi thieu 14 ngay du lieu lich su de du bao dang tin cay"
        )

    df = pd.DataFrame([{"ds": p.date, "y": p.revenue} for p in req.history])
    df["ds"] = pd.to_datetime(df["ds"])
    df = df.sort_values("ds").reset_index(drop=True)

    holidays_df = None
    if req.holidays:
        holidays_df = pd.DataFrame({
            "holiday": "special_day",
            "ds": pd.to_datetime(req.holidays),
            "lower_window": 0,
            "upper_window": 1,
        })

    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=len(df) >= 365,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        holidays=holidays_df,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=req.periods, freq=req.freq)
    forecast_df = model.predict(future)

    result = forecast_df[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(req.periods).copy()
    result["ds"] = result["ds"].dt.strftime("%Y-%m-%d")
    result["yhat"] = result["yhat"].round(0)
    result["yhat_lower"] = result["yhat_lower"].round(0)
    result["yhat_upper"] = result["yhat_upper"].round(0)

    return {
        "branch_id": req.branch_id,
        "history_points_used": len(df),
        "forecast": result.to_dict(orient="records"),
    }
