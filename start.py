import subprocess
import sys
import os

os.chdir(os.path.join(os.path.dirname(__file__), "backend"))
sys.exit(subprocess.call([
    sys.executable, "-m", "uvicorn",
    "server:socket_app",
    "--host", "0.0.0.0",
    "--port", str(os.environ.get("PORT", "8001")),
    "--workers", "1"
]))
