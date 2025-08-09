# royalroad_clone/settings_prod.py
from .settings import *  # noqa
import os
from urllib.parse import urlparse

DEBUG = False
SECRET_KEY = os.environ.get("SECRET_KEY", "CHANGE-ME")

# Hosts / CSRF
_default_hosts = ["localhost", "127.0.0.1", ".onrender.com"]
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", ",".join(_default_hosts)).split(",") if h.strip()]

_csrf = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
# Django requires full scheme (https://) for CSRF_TRUSTED_ORIGINS
CSRF_TRUSTED_ORIGINS = _csrf or [f"https://{h.lstrip('.')}" for h in ALLOWED_HOSTS if not h.startswith("localhost")]

# (Optional) If using django-cors-headers in base settings
_cors = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _cors:
    CORS_ALLOWED_ORIGINS = _cors
    CORS_ALLOW_CREDENTIALS = True

# Static via WhiteNoise
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
_mw = list(MIDDLEWARE)
try:
    i = _mw.index("django.middleware.security.SecurityMiddleware") + 1
except ValueError:
    i = 0
_mw.insert(i, "whitenoise.middleware.WhiteNoiseMiddleware")
MIDDLEWARE = _mw
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Database from DATABASE_URL
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    try:
        import dj_database_url
        DATABASES["default"] = dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    except Exception:
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

# Security (HTTPS on Render proxies)
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
