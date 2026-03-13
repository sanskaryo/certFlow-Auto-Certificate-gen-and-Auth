import os
import uuid
import logging
import base64
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_certificate_background(description: str, event_id: str) -> str:

    logger.info(f"Generating AI certificate template for event {event_id}")

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY missing")

    client = OpenAI(api_key=settings.openai_api_key)

    prompt = f"""
Professional certificate template background for event: {description}.

Layout:
- Landscape certificate format
- Elegant thin border frame
- Decorative elements ONLY in corners and edges
- Large empty center area (60%) reserved for text
- Top center space reserved for certificate title
- Top corner reserved for logo
- Bottom left and right space reserved for signatures

Design Style:
minimal, professional, corporate, academic certificate design
soft gradient background or premium paper texture
symmetrical layout
clean and premium look

STRICT RULES:
- No text
- No letters
- No numbers
- No typography
- Do not place any objects in the center
- Keep center completely empty
"""

    try:

        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="hd",
            style="natural",
            response_format="b64_json"
        )

        image_base64 = response.data[0].b64_json
        image_bytes = base64.b64decode(image_base64)

        os.makedirs("uploads", exist_ok=True)

        filename = f"ai_bg_{event_id}_{uuid.uuid4().hex[:8]}.png"
        file_path = os.path.join("uploads", filename)

        with open(file_path, "wb") as f:
            f.write(image_bytes)

        logger.info(f"Template saved: {file_path}")

        return file_path

    except Exception as e:
        logger.error(f"Template generation failed: {e}")
        raise


# def generate_certificate_background(description: str, event_id: str) -> str:
#     """
#     Generates a certificate background image using OpenAI DALL-E 3.
#     Returns the file path to the generated image.
#     """
#     logger.info(f"Starting AI template generation for event {event_id} with description: '{description}'")
#     if not settings.openai_api_key:
#         logger.error("OPENAI_API_KEY is not set in the environment.")
#         raise ValueError("OPENAI_API_KEY is not set in the environment.")
        
#     client = OpenAI(api_key=settings.openai_api_key)
    
#     # Improved prompt based on user's structure
#     prompt = (
#         f"Minimalist certificate background for: {description}. "
#         "Professional and modern design, subtle abstract patterns, glowing nodes, geometric shapes, "
#         "elegant borders, plenty of empty space in the center for text, soft gradients, "
#         "corporate style, high resolution, symmetrical layout, vector style, clean and premium look. "
#         "IMPORTANT: Do NOT include any text, words, letters, or typography in the image. It must be a blank template."
#     )
    
#     try:
#         logger.info(f"Sending prompt to OpenAI for event {event_id}")
#         response = client.images.generate(
#             model="dall-e-3",
#             prompt=prompt,
#             size="1792x1024",
#             response_format="b64_json"
#         )
        
#         image_base64 = response.data[0].b64_json
#         if image_base64:
#             image_bytes = base64.b64decode(image_base64)
            
#             os.makedirs("uploads", exist_ok=True)
#             filename = f"ai_bg_{event_id}_{uuid.uuid4().hex[:8]}.png"
#             file_path = os.path.join("uploads", filename)
            
#             with open(file_path, "wb") as f:
#                 f.write(image_bytes)
                
#             logger.info(f"SUCCESS: AI Template generated successfully from OpenAI and saved to {file_path}")
#             return file_path
            
#         logger.error("No image data found in the AI response.")
#         raise ValueError("No image data found in the AI response.")
#     except Exception as e:
#         logger.error(f"FAILURE: Error generating AI background from OpenAI: {e}")
#         raise e
