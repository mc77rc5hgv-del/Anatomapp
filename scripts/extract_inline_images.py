"""Extract inline raster data URLs from index.html into cacheable assets.

The script is deterministic: filenames are derived from the decoded source
bytes, duplicate images share one file, and WebP is kept only when it is
smaller than the original payload.
"""

from __future__ import annotations

import base64
import hashlib
import io
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
OUTPUT = ROOT / "assets" / "media"
DATA_URL = re.compile(
    rb"data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)", re.IGNORECASE
)


def optimized_asset(mime: str, raw: bytes) -> tuple[str, bytes]:
    """Return the smallest safe representation and its extension."""
    original_ext = "jpg" if mime in {"jpeg", "jpg"} else mime
    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")
            target = io.BytesIO()
            image.save(target, "WEBP", quality=86, method=6)
            webp = target.getvalue()
            if len(webp) < len(raw) * 0.98:
                return "webp", webp
    except (OSError, ValueError):
        pass
    return original_ext, raw


def main() -> None:
    source = HTML.read_bytes()
    matches = list(DATA_URL.finditer(source))
    if not matches:
        print("No inline raster images found.")
        return

    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets: dict[str, bytes] = {}
    replacements: dict[bytes, bytes] = {}
    original_bytes = 0

    for match in matches:
        full = match.group(0)
        if full in replacements:
            continue
        mime = match.group(1).decode("ascii").lower()
        raw = base64.b64decode(match.group(2), validate=True)
        original_bytes += len(raw)
        digest = hashlib.sha256(raw).hexdigest()[:16]
        ext, payload = optimized_asset(mime, raw)
        name = f"inline-{digest}.{ext}"
        assets[name] = payload
        replacements[full] = f"assets/media/{name}".encode("ascii")

    def replace(match: re.Match[bytes]) -> bytes:
        return replacements[match.group(0)]

    result = DATA_URL.sub(replace, source)
    for name, payload in assets.items():
        target = OUTPUT / name
        if not target.exists() or target.read_bytes() != payload:
            target.write_bytes(payload)
    HTML.write_bytes(result)

    output_bytes = sum(len(payload) for payload in assets.values())
    print(
        f"Replaced {len(matches)} data URLs with {len(assets)} unique assets; "
        f"decoded images {original_bytes:,} -> {output_bytes:,} bytes; "
        f"HTML {len(source):,} -> {len(result):,} bytes."
    )


if __name__ == "__main__":
    main()
