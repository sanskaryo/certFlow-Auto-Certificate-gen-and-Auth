"""
Middleware that detects requests coming from a known custom domain
and injects org branding into the request state so route handlers
can use it (or pass it through to the verify response).
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class CustomDomainMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        host = request.headers.get("host", "").split(":")[0].lower()

        # Skip localhost / certflow's own domains
        if host in ("localhost", "127.0.0.1", "verify.certflow.app", "certflow.app"):
            return await call_next(request)

        # Lazy import to avoid circular deps at module load time
        from app.database import get_database
        db = get_database()
        if db is not None:
            try:
                org = await db.users.find_one({"custom_domain": host, "domain_verified": True})
                if org:
                    request.state.org_branding = {
                        "org_name": org.get("org_name_override") or org.get("name", ""),
                        "primary_color": org.get("primary_color", "#0d9488"),
                        "white_label": bool(org.get("white_label")),
                        "remove_branding": bool(org.get("remove_branding")),
                    }
            except Exception:
                pass

        return await call_next(request)
