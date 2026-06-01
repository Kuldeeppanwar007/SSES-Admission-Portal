import logging
import socket
import dns.resolver

# ── DNS MONKEYPATCH FOR ISP BLOCKS ───────────────────────────────────────────
# Intercepts DNS queries for Plivo and MongoDB/Groq to use Google/Cloudflare DNS
# directly, bypassing broken local ISP DNS servers that cause [Errno 11001] errors.
_original_getaddrinfo = socket.getaddrinfo

def custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    # Decode host to string if it is a bytes object
    host_str = host.decode('utf-8') if isinstance(host, bytes) else host

    if host_str == "agentflow.plivo.com" or "mongodb.net" in host_str or "groq.com" in host_str:
        try:
            resolver = dns.resolver.Resolver()
            resolver.nameservers = ['8.8.8.8', '1.1.1.1']
            resolver.timeout = 5
            resolver.lifetime = 5
            answers = resolver.resolve(host_str, 'A')
            ips = [rdata.address for rdata in answers]
            
            # Map service names or string ports to integer ports to satisfy C-level requirements
            resolved_port = port
            if isinstance(port, str):
                if port == "https":
                    resolved_port = 443
                elif port == "http":
                    resolved_port = 80
                else:
                    try:
                        resolved_port = socket.getservbyname(port)
                    except Exception:
                        try:
                            resolved_port = int(port)
                        except Exception:
                            resolved_port = 0
            elif port is None:
                resolved_port = 0

            results = []
            for ip in ips:
                f = family if family != 0 else socket.AF_INET
                t = type if type != 0 else socket.SOCK_STREAM
                p = proto if proto != 0 else 6
                results.append((f, t, p, '', (ip, resolved_port)))
            if results:
                return results
        except Exception:
            pass
            
    return _original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = custom_getaddrinfo
# ─────────────────────────────────────────────────────────────────────────────

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from .database import init_db, close_db
from .routers import callbacks, leads, plivo_webhook, whatsapp
from .routers import auth as auth_router
from .routers import agent as agent_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    log.info("MongoDB connected and indexes ensured")
    yield
    await close_db()
    log.info("MongoDB disconnected")


def create_app() -> FastAPI:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )

    app = FastAPI(
        title="SSISM Admission Agent API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router.router,    prefix="/api/v1")
    app.include_router(agent_router.router,   prefix="/api/v1")
    app.include_router(leads.router,          prefix="/api/v1")
    app.include_router(callbacks.router,      prefix="/api/v1")
    app.include_router(plivo_webhook.router,  prefix="/api/v1")
    app.include_router(whatsapp.router,       prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "ssism-admission-agent"}

    return app


app = create_app()
