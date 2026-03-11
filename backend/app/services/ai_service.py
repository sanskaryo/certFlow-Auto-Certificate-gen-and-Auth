import os
import uuid
from google import genai
from app.core.config import settings

def generate_certificate_background(description: str, event_id: str) -> str:
    """
    Generates a certificate background image using Gemini Imagen.
    Returns the file path to the generated image.
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set in the environment.")
        
    client = genai.Client(api_key=settings.gemini_api_key)
    
    # Refine the prompt to ensure it generates a good certificate background without text
    prompt = (
        f"Create a professional, blank certificate background design based on this theme: {description}. "
        "The design should be suitable for a landscape A4 paper format. "
        "IMPORTANT: Do NOT include any text, words, or letters in the image. It must be a blank template."
    )
    
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=[prompt],
        )
        
        for part in response.parts:
            if part.inline_data is not None:
                image = part.as_image()
                
                os.makedirs("uploads", exist_ok=True)
                filename = f"ai_bg_{event_id}_{uuid.uuid4().hex[:8]}.png"
                file_path = os.path.join("uploads", filename)
                
                image.save(file_path)
                return file_path
                
        raise ValueError("No image data found in the AI response.")
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error generating AI background: {e}")
        raise e
