"""Regenerate approved GymDrobe external launcher assets without changing splash screens."""
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
subprocess.run(
    [sys.executable, str(ROOT / "scripts/generate-transparent-favicons.py")],
    check=True,
)
