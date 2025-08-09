# settings_prod.py — production settings for Render
# Save to: C:\Users\martinb.PERTH\code\royalroad_clone\royalroad_clone\settings_prod.py

from .settings import *  # noqa
import os
from urllib.parse import urlparse

# --- Core ---
DEBUG = False
SECRET_KEY = os.environ.get("SECRET_KEY", "CHANGE-ME")  # Render will generate this

# Allow your Render URL + optional custom domains
_default_hosts = ["localhost", "127.0.0.1", ".onrender.com"]
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("ALLOWED_HOSTS", ",".join(_default_hosts)).split(",") if h.strip()
]

# CSRF / CORS: trust your front-end origins if you set them
_csrf = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
CSRF_TRUSTED_ORIGINS = _csrf or [f"https://{h.lstrip('.')}" for h in ALLOWED_HOSTS if not h.startswith("localhost")]

# If you already use django-cors-headers in base settings, these will apply.
_cors = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _cors:
    CORS_ALLOWED_ORIGINS = _cors
    CORS_ALLOW_CREDENTIALS = True

# --- Static files (via WhiteNoise) ---
# Collects to /staticfiles and serves via WhiteNoise (middleware added below)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # Render docs recommend this folder

# Insert WhiteNoise middleware right after SecurityMiddleware
_mw = list(MIDDLEWARE)
try:
    idx = _mw.index("django.middleware.security.SecurityMiddleware") + 1
except ValueError:
    idx = 0
_mw.insert(idx, "whitenoise.middleware.WhiteNoiseMiddleware")
MIDDLEWARE = _mw

# Compressed + hashed filenames for long-term caching
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# --- Database (DATABASE_URL from Render) ---
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    try:
        import dj_database_url  # installed in render.yaml build step
        DATABASES["default"] = dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    except Exception:
        # Fallback mini-parser for Postgres/SQLite if dj-database-url isn't available
        u = urlparse(DATABASE_URL)
        if u.scheme.startswith("postgres"):
            DATABASES["default"] = {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": (u.path or "").lstrip("/") or "postgres",
                "USER": u.username or "",
                "PASSWORD": u.password or "",
                "HOST": u.hostname or "localhost",
                "PORT": str(u.port or 5432),
                "CONN_MAX_AGE": 600,
            }
        elif u.scheme.startswith("sqlite"):
            DATABASES["default"] = {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": os.path.join(BASE_DIR, (u.path or "").lstrip("/")) or (BASE_DIR / "db.sqlite3"),
            }

# --- Security ---
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Keep default logging; you can add Sentry later if you like.
