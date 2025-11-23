import logging
import os
import asyncio
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.items import router as items_router
from routers.predict import router as predict_router
from routers.orders import router as orders_router
from routers.sales import router as sales_router
from routers.predictive import router as predictive_router
from routers.reports import router as reports_router
from routers.dashboard import router as dashboard_router
from routers.activity_logs import router as activity_logs_router
from routers.stockcard import router as stockcard_router
from services.predictive_service import (
    load_models_from_disk,
    train_from_db_and_persist,
    get_train_status,
)

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI()

# ----------------------------------------------------------
# Predictive auto-train scheduler (daily; skips if already ran today)
# ----------------------------------------------------------
async def _predictive_auto_train_loop():
    await asyncio.sleep(5)  # allow app to finish startup
    while True:
        try:
            status = get_train_status()
            last_ts = status.get("last_trained_utc")
            today = datetime.utcnow().date()
            already_ran_today = False
            if isinstance(last_ts, str):
                try:
                    parsed = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
                    already_ran_today = parsed.date() == today
                except Exception:
                    already_ran_today = False

            if not already_ran_today:
                logging.info("Auto-train: starting predictive retrain from DB history.")
                await asyncio.get_running_loop().run_in_executor(
                    None, train_from_db_and_persist
                )
                logging.info("Auto-train: finished predictive retrain.")
            else:
                logging.debug("Auto-train: already ran today; skipping.")
        except Exception as exc:
            logging.exception("Auto-train loop failed: %s", exc)

        # Sleep roughly a day; adjust if you want more frequent updates
        await asyncio.sleep(24 * 60 * 60)


@app.on_event("startup")
async def _startup():
    load_models_from_disk()
    app.state.predictive_task = asyncio.create_task(_predictive_auto_train_loop())


@app.on_event("shutdown")
async def _shutdown():
    task = getattr(app.state, "predictive_task", None)
    if task:
        task.cancel()

# ----------------------------------------------------------
# Root endpoint (health check)
# ----------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok"}

# ----------------------------------------------------------
# CORS
# ----------------------------------------------------------
# Base allowed origins (local + deployed)
base_origins = [
    # Deployed frontend(s)
    "https://itrack-student-view.vercel.app",
    "https://capstone-itrack.vercel.app",

    # Local React dev servers
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",      # if you use Vite
    "http://127.0.0.1:5173",
]

# Extra origins from env (optional; for Render, etc.)
env_origins = (
    os.getenv("CORS_ALLOWED_ORIGINS")      # new name
    or os.getenv("CORS_ORIGINS")          # backward compatible
    or ""
)

extra_origins = [o.strip() for o in env_origins.split(",") if o.strip()]

origins = base_origins + extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,      # ✅ required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------------
# Routers
# ----------------------------------------------------------
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(items_router)
app.include_router(predict_router)
app.include_router(orders_router)
app.include_router(sales_router)
app.include_router(predictive_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(activity_logs_router)
app.include_router(stockcard_router)
