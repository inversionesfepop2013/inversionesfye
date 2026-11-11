from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import os
import re
import time

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ALLOWED_ORIGINS = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "").split(",") if x.strip()]
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "inversionesfepop@gmail.com")
SUPPORT_PHONE = os.getenv("SUPPORT_PHONE", "809-739-4404")

app = FastAPI(title="Inversiones FYE API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def supabase_admin():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="El servicio de datos no está configurado.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def current_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inicia sesión para consultar tus cuentas.")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sesión inválida.")
    try:
        result = supabase_admin().auth.get_user(token)
        user = getattr(result, "user", None)
        if user is None and isinstance(result, dict):
            user = result.get("user")
        if not user:
            raise ValueError("No valid user")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="La sesión expiró. Inicia sesión nuevamente.")


@app.get("/api/health")
def health():
    return {"ok": True, "service": "inversiones-fye-api", "supabase_configured": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)}


@app.get("/api/customer-balances")
def customer_balances(authorization: Optional[str] = Header(default=None)):
    """Return only rows owned by the authenticated Supabase user."""
    user = current_user(authorization)
    user_id = str(getattr(user, "id", "") or (user.get("id") if isinstance(user, dict) else ""))
    if not user_id:
        raise HTTPException(status_code=401, detail="Sesión inválida.")

    try:
        db = supabase_admin()
        result = (
            db.table("fye_account_balances")
            .select("account_id,owner_profile_id,account_type,currency_code,balance,status,opened_on")
            .eq("owner_profile_id", user_id)
            .neq("status", "closed")
            .order("opened_on")
            .execute()
        )
        rows = result.data or []
        # Never pass internal identifiers or unrelated account data to the client.
        safe_rows = [{
            "account_type": row.get("account_type"),
            "currency_code": row.get("currency_code"),
            "balance": row.get("balance", 0),
            "status": row.get("status"),
            "opened_on": row.get("opened_on"),
        } for row in rows]
        return {"ok": True, "balances": safe_rows}
    except HTTPException:
        raise
    except Exception:
        # Do not expose SQL, PostgREST, or account details to customers.
        raise HTTPException(status_code=503, detail="No se pudieron cargar tus balances. Intenta más tarde o contacta soporte.")


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    message: str = Field(..., min_length=10, max_length=1500)


@app.post("/api/contact")
def contact(payload: ContactRequest):
    try:
        db = supabase_admin()
        db.table("contact_messages").insert({
            "name": re.sub(r"\s+", " ", payload.name).strip(),
            "email": str(payload.email).lower(),
            "phone": payload.phone,
            "message": re.sub(r"\s+", " ", payload.message).strip(),
        }).execute()
        return {"ok": True, "message": "Mensaje recibido correctamente."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail=f"No se pudo enviar el mensaje. Contacta {CONTACT_EMAIL} o llama al {SUPPORT_PHONE}.")


@app.get("/")
def root():
    return {"ok": True, "service": "Inversiones FYE"}
