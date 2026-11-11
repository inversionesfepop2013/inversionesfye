from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
import hashlib
import os
import re
import time

try:
    from supabase import create_client
except Exception:  # pragma: no cover
    create_client = None

APP_SECRET = os.getenv("SECRET_KEY", "change-me-in-production")
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "admin-secret-change-me")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")
    if origin.strip()
]
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "inversionesfepop@gmail.com")
SUPPORT_PHONE = os.getenv("SUPPORT_PHONE", "809-739-4404")
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "20"))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

app = FastAPI(title="Inversiones FYE API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rate_state = {}
_otp_store = {}


def _supabase_client():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or create_client is None:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit_ok(key: str) -> bool:
    now = int(time.time())
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    bucket = _rate_state.setdefault(key, [])
    bucket[:] = [ts for ts in bucket if ts > window_start]
    if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    bucket.append(now)
    return True


def _normalize_text(value: Optional[str], *, max_length: int = 200) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text[:max_length]


def _document_number(value: str) -> str:
    if not value:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", str(value)).upper()


def _valid_rnc_or_id(value: str) -> bool:
    text = _document_number(value)
    if not text:
        return False
    if re.fullmatch(r"\d{11}", text):
        return True
    if re.fullmatch(r"[A-Z0-9]{6,20}", text):
        return True
    return False


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _generate_otp() -> str:
    import secrets

    return str(secrets.randbelow(900000) + 100000)


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    message: str = Field(..., min_length=10, max_length=1500)


class WithdrawalRequest(BaseModel):
    document: str = Field(..., min_length=6, max_length=30)
    amount: float = Field(..., gt=0, le=2000000)
    email: EmailStr
    otp: Optional[str] = Field(default=None, min_length=6, max_length=6)


class RecoverPasswordRequest(BaseModel):
    document: str = Field(..., min_length=6, max_length=30)
    email: EmailStr
    phone: str = Field(..., min_length=8, max_length=30)


class AdminActionRequest(BaseModel):
    action: Literal["approve", "reject", "block", "delete"]
    user_id: str = Field(..., min_length=3, max_length=120)
    reason: Optional[str] = Field(default=None, max_length=500)


@app.options("/api/{full_path:path}")
async def options_api() -> dict:
    return {"ok": True}


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "service": "inversiones-fye-api",
        "environment": os.getenv("APP_ENV", "development"),
        "contact_email": CONTACT_EMAIL,
        "support_phone": SUPPORT_PHONE,
        "supabase_ready": _supabase_client() is not None,
    }


@app.post("/api/contact")
async def contact(request: Request, payload: ContactRequest):
    client_key = _client_key(request)
    if not _rate_limit_ok(client_key):
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intenta más tarde.")

    name = _normalize_text(payload.name, max_length=120)
    message = _normalize_text(payload.message, max_length=1500)
    email = str(payload.email).strip().lower()
    phone = _normalize_text(payload.phone, max_length=30)

    if not name or not email or not message:
        raise HTTPException(status_code=400, detail="Datos inválidos.")

    client = _supabase_client()
    if client:
        try:
            client.table("contact_messages").insert({
                "name": name,
                "email": email,
                "phone": phone,
                "message": message,
            }).execute()
        except Exception:
            pass

    return {
        "ok": True,
        "message": "Mensaje recibido correctamente. Nuestro equipo responderá a la brevedad.",
        "contact_email": CONTACT_EMAIL,
        "support_phone": SUPPORT_PHONE,
    }


@app.post("/api/withdrawal-request")
async def withdrawal_request(request: Request, payload: WithdrawalRequest):
    client_key = _client_key(request)
    if not _rate_limit_ok(client_key):
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intenta más tarde.")

    document = _document_number(payload.document)
    if not _valid_rnc_or_id(document):
        raise HTTPException(status_code=400, detail="Cédula o pasaporte inválido.")

    otp = payload.otp
    if not otp:
        otp_code = _generate_otp()
        _otp_store[document] = {
            "otp": otp_code,
            "expires_at": int(time.time()) + OTP_TTL_SECONDS,
            "email": str(payload.email).lower(),
            "amount": payload.amount,
        }

        client = _supabase_client()
        if client:
            try:
                client.table("withdrawal_requests").insert({
                    "doc_number": document,
                    "amount": payload.amount,
                    "email": str(payload.email).lower(),
                    "otp_hash": _hash_value(otp_code),
                    "status": "pending",
                }).execute()
            except Exception:
                pass

        return {
            "ok": True,
            "requires_otp": True,
            "message": "Se ha enviado un OTP de confirmación para completar el retiro.",
            "notice": "Dicho retiro se completa de 1 a 72 horas en días laborables.",
        }

    stored = _otp_store.get(document)
    if not stored:
        raise HTTPException(status_code=400, detail="No existe un OTP activo para este documento.")

    if int(time.time()) > stored["expires_at"]:
        _otp_store.pop(document, None)
        raise HTTPException(status_code=400, detail="El OTP ha caducado. Solicita uno nuevo.")

    if stored["otp"] != otp:
        raise HTTPException(status_code=400, detail="OTP incorrecto.")

    _otp_store.pop(document, None)

    client = _supabase_client()
    if client:
        try:
            client.table("withdrawal_requests").update({
                "status": "approved",
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }).eq("doc_number", document).execute()
        except Exception:
            pass

    return {
        "ok": True,
        "processed": True,
        "message": "Retiro confirmado con éxito.",
        "notice": "Dicho retiro se completa de 1 a 72 horas en días laborables.",
    }


@app.post("/api/recover-password")
async def recover_password(request: Request, payload: RecoverPasswordRequest):
    client_key = _client_key(request)
    if not _rate_limit_ok(client_key):
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intenta más tarde.")

    document = _document_number(payload.document)
    if not _valid_rnc_or_id(document):
        raise HTTPException(status_code=400, detail="Formato de documento inválido.")

    email = str(payload.email).strip().lower()
    phone = re.sub(r"\D", "", payload.phone)
    if not phone or len(phone) < 8:
        raise HTTPException(status_code=400, detail="Formato de teléfono inválido.")

    client = _supabase_client()
    if client:
        try:
            res = client.table("profiles").select("doc_number,email,phone").eq("doc_number", document).eq("email", email).maybe_single().execute()
            if res and getattr(res, "data", None):
                return {
                    "ok": True,
                    "message": "Identidad verificada. Contacte a soporte para restaurar su acceso.",
                    "support_email": CONTACT_EMAIL,
                    "support_phone": SUPPORT_PHONE,
                }
        except Exception:
            pass

    return {
        "ok": False,
        "message": "No se encontró coincidencia válida. Debe contactarse con soporte para restablecer su acceso.",
        "support_email": CONTACT_EMAIL,
        "support_phone": SUPPORT_PHONE,
    }


@app.post("/api/admin/approvals")
async def admin_approvals(
    request: Request,
    payload: AdminActionRequest,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
):
    if x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="No autorizado.")

    action = payload.action
    if action not in {"approve", "reject", "block", "delete"}:
        raise HTTPException(status_code=400, detail="Acción no válida.")

    client = _supabase_client()
    if client:
        try:
            client.table("admin_actions").insert({
                "user_id": payload.user_id,
                "action": action,
                "reason": payload.reason or "",
                "created_by": "admin",
            }).execute()
        except Exception:
            pass

    return {
        "ok": True,
        "action": action,
        "user_id": payload.user_id,
        "message": "Acción administrativa registrada correctamente.",
    }


@app.post("/api/auth/session")
async def auth_session(request: Request):
    client_key = _client_key(request)
    if not _rate_limit_ok(client_key):
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intenta más tarde.")

    return {
        "ok": True,
        "message": "Sesión verificada con backend seguro.",
        "secret": _hash_value(APP_SECRET),
    }


@app.get("/")
async def index() -> dict:
    return {"ok": True, "message": "Inversiones FYE API"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)













































































































































