import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Podacium API", version="1.0")

# Read allowed origins from env var, fallback to some defaults
origins_env = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3001,https://your-vercel-url.vercel.app,https://podacium.com"
)
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to Podacium API"}

