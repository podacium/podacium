"""
Image Optimization Service.

On upload, generates optimized variants:
- WebP format (lossy, quality 80)
- Thumbnails: 320px, 640px, 1280px widths
- Original preserved as fallback

Stores variants with predictable paths:
  /uploads/{category}/{id}/original.{ext}
  /uploads/{category}/{id}/320w.webp
  /uploads/{category}/{id}/640w.webp
  /uploads/{category}/{id}/1280w.webp
"""
import logging
import io
from pathlib import Path
from typing import Dict

logger = logging.getLogger(__name__)

# Sizes to generate (width in pixels)
VARIANT_SIZES = [320, 640, 1280]
WEBP_QUALITY = 80
MAX_UPLOAD_DIMENSION = 4096  # Max width/height before resize


def is_image(content_type: str) -> bool:
    """Check if a file is an image based on content type."""
    return content_type.startswith("image/") and content_type not in [
        "image/svg+xml",  # Don't process SVGs
    ]


async def optimize_image(
    file_bytes: bytes,
    content_type: str,
    category: str,
    file_id: str,
    upload_dir: Path,
) -> Dict[str, str]:
    """
    Process an uploaded image and generate optimized variants.
    
    Returns a dict of variant paths:
    {
        "original": "/static/{category}/{id}/original.jpg",
        "320w": "/static/{category}/{id}/320w.webp",
        "640w": "/static/{category}/{id}/640w.webp",
        "1280w": "/static/{category}/{id}/1280w.webp",
    }
    """
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed — skipping image optimization")
        return {}

    variants: Dict[str, str] = {}
    
    # Create output directory
    output_dir = upload_dir / category / file_id
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Open image
        img = Image.open(io.BytesIO(file_bytes))
        
        # Convert RGBA to RGB for JPEG/WebP compatibility
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Determine original extension
        ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
        ext = ext_map.get(content_type, "jpg")

        # Save original (resized if too large)
        original = img.copy()
        if max(original.size) > MAX_UPLOAD_DIMENSION:
            original.thumbnail((MAX_UPLOAD_DIMENSION, MAX_UPLOAD_DIMENSION), Image.LANCZOS)
        
        original_path = output_dir / f"original.{ext}"
        original.save(str(original_path), quality=90)
        variants["original"] = f"/static/{category}/{file_id}/original.{ext}"

        # Generate WebP variants at different sizes
        for width in VARIANT_SIZES:
            if img.width >= width:
                # Calculate proportional height
                ratio = width / img.width
                height = int(img.height * ratio)
                
                resized = img.resize((width, height), Image.LANCZOS)
                variant_path = output_dir / f"{width}w.webp"
                resized.save(str(variant_path), "WEBP", quality=WEBP_QUALITY)
                variants[f"{width}w"] = f"/static/{category}/{file_id}/{width}w.webp"

        logger.info(f"Generated {len(variants)} image variants for {category}/{file_id}")
        return variants

    except Exception as e:
        logger.error(f"Image optimization failed: {e}")
        # Fall back to just saving the original
        original_path = output_dir / f"original.{ext_map.get(content_type, 'jpg')}"
        original_path.write_bytes(file_bytes)
        variants["original"] = f"/static/{category}/{file_id}/original.{ext_map.get(content_type, 'jpg')}"
        return variants


def get_srcset(variants: Dict[str, str], base_url: str = "") -> str:
    """
    Generate an HTML srcset string from variants.
    
    Example output: "/static/avatars/123/320w.webp 320w, /static/avatars/123/640w.webp 640w"
    """
    srcset_parts = []
    for key, path in variants.items():
        if key.endswith("w"):
            width = key.replace("w", "")
            srcset_parts.append(f"{base_url}{path} {width}w")
    return ", ".join(srcset_parts)
