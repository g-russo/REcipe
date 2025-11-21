from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO
from dotenv import load_dotenv
import io
import os
import time
import hashlib
import hmac
import urllib.parse
import requests
import torch
import pytesseract
import traceback
import google.generativeai as genai
from google.ai.generativelanguage import Content, Part

# ✅ Load .env file FIRST
load_dotenv()

# ✅ EXPLICITLY SET TESSERACT PATH FOR LINUX
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# FatSecret API credentials
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
FATSECRET_KEY = os.getenv("FATSECRET_CLIENT_ID", "")
FATSECRET_SECRET = os.getenv("FATSECRET_CLIENT_SECRET", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def call_server_api(method: str, params: dict = None):
    timestamp = str(int(time.time()))
    nonce = hashlib.md5(timestamp.encode()).hexdigest()
    
    base_params = {
        "method": method,
        "oauth_consumer_key": FATSECRET_KEY,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp,
        "oauth_nonce": nonce,
        "oauth_version": "1.0",
        "format": "json"
    }
    
    if params:
        base_params.update(params)
    
    sorted_params = sorted(base_params.items())
    param_string = "&".join([f"{k}={urllib.parse.quote(str(v), safe='')}" for k, v in sorted_params])
    
    base_string = f"POST&{urllib.parse.quote(FATSECRET_API_URL, safe='')}&{urllib.parse.quote(param_string, safe='')}"
    
    signing_key = f"{urllib.parse.quote(FATSECRET_SECRET, safe='')}&"
    signature = hmac.new(
        signing_key.encode(),
        base_string.encode(),
        hashlib.sha1
    ).digest()
    
    oauth_signature = urllib.parse.quote(
        hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).hexdigest()
    )
    
    base_params["oauth_signature"] = oauth_signature
    
    response = requests.post(FATSECRET_API_URL, data=base_params)
    return response.json()

# ✅ Load all models at startup
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"🔧 Using device: {device}")

# Get the directory where api.py is located to correctly find models
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

detector_model = YOLO(MODELS_DIR / 'best.pt').to(device)
food101_model = YOLO(MODELS_DIR / 'food101_cls_best.pt').to(device)
filipino_model = YOLO(MODELS_DIR / 'filipino_cls_best.pt').to(device)
ingredients_model = YOLO(MODELS_DIR / 'ingredients_best.pt').to(device)

# ✅ Configure Gemini
gemini_model = None

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        print("✅ Gemini 2.0 Flash configured")
    except Exception as e:
        print(f"⚠️ Gemini configuration failed: {e}")
else:
    print("⚠️ Gemini API Key missing")

print("✅ All models loaded successfully!")
print(f"🔍 Tesseract path: {pytesseract.pytesseract.tesseract_cmd}")

app = FastAPI(title="REcipe API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "device": device}

def pil_from_upload(upload: UploadFile) -> Image.Image:
    return Image.open(io.BytesIO(upload.file.read())).convert("RGB")

def topk_from_probs(res, k: int):
    """Extract top-k predictions from classification results"""
    try:
        if res is None or len(res) == 0:
            print("⚠️ Warning: No results from model")
            return []
        
        if hasattr(res[0], 'probs') and res[0].probs is not None:
            probs = res[0].probs.data.cpu().numpy()
            names = res[0].names
            top_indices = probs.argsort()[-k:][::-1]
            return [{"name": names[i], "confidence": float(probs[i])} for i in top_indices]
        else:
            print("⚠️ Warning: Model result has no probs attribute")
            return []
    except Exception as e:
        print(f"❌ Error extracting predictions: {e}")
        return []

# Rate Limiting for Gemini (Free Tier Protection)
# Free tier allows ~15 RPM (Requests Per Minute). We set it to 10 to be safe.
GEMINI_RPM_LIMIT = 10
gemini_request_timestamps = []

def check_gemini_rate_limit():
    """
    Checks if we are within the rate limit for Gemini API.
    Returns True if allowed, False if limit reached.
    """
    global gemini_request_timestamps
    now = time.time()
    
    # Remove timestamps older than 60 seconds
    gemini_request_timestamps = [t for t in gemini_request_timestamps if now - t < 60]
    
    if len(gemini_request_timestamps) >= GEMINI_RPM_LIMIT:
        print(f"⚠️ Gemini Rate Limit Reached ({len(gemini_request_timestamps)}/{GEMINI_RPM_LIMIT} RPM). Skipping.")
        return False
        
    gemini_request_timestamps.append(now)
    return True

def call_gemini_vision(image: Image.Image):
    """
    Calls Gemini 2.0 Flash with the image to identify food.
    Returns structured JSON.
    """
    print("✨ call_gemini_vision triggered")
    
    # ✅ Check Rate Limit
    if not check_gemini_rate_limit():
        return None

    if not gemini_model:
        print("❌ gemini_model is None")
        return None

    prompt = """
    You are an expert in Filipino cuisine. Analyze this food image and identify the dish/ingredient.
    
    Key Instructions:
    1. Prioritize Filipino dishes/ingredients. If the dish looks like a generic international dish (e.g., Spaghetti, Fried Chicken, Curry) but has Filipino characteristics (e.g., red hotdogs in spaghetti, gravy with chicken), identify it as the Filipino version.
    2. Look for visual cues common in Filipino cooking: specific vegetables (eggplant, okra, kangkong), sauces (adobo, sinigang, kare-kare), or side dishes (rice, dipping sauces).
    3. If it is a regional Filipino specialty, provide the specific local name.
    4. If it is definitely NOT Filipino, identify it correctly as its international name.
    5. If the image is NOT food (e.g., a person, car, landscape, blurry object), return "Not a Food" as the name.
    6. If you cannot identify the food at all, return "Unknown Food" as the name.
    7. Provide top 5 possible identifications, sorted by confidence (highest first).
    8. Assign a realistic confidence score (0.0 to 0.99) for each prediction based on how certain you are. Do not default to 0.99 unless absolutely certain.
    9. Do NOT return generic cuisine names (e.g., "Italian Cuisine", "American Food") or meal types. Return ONLY specific dish names (e.g., "Carbonara", "Burger") or ingredient names.
    
    Return strict JSON format:
    [
        {
            "name": "Dish or Ingredient Name",
            "confidence": 0.6 to 0.99
        },
        {
            "name": "Dish or Ingredient Name that may look similar",
            "confidence": 0.6 to 0.99
        }
    ]
    """
    
    try:
        print("⏳ Sending request to Gemini...")
        response = gemini_model.generate_content(
            [prompt, image],
            generation_config={"response_mime_type": "application/json"}
        )
        print(f"✅ Gemini Raw Response: {response.text}")
        import json
        return json.loads(response.text)
    except Exception as e:
        print(f"❌ Gemini Error: {e}")
        traceback.print_exc()
        return None

@app.post("/recognize-food")
async def recognize_food(file: UploadFile = File(...)):
    """
    Recognize food in an image using object detection and classification.
    ✅ NOW INCLUDES INGREDIENT DETECTION!
    """
    try:
        # Load image
        try:
            img = pil_from_upload(file)
            print(f"✅ Image loaded successfully: {img.size}")
        except Exception as img_error:
            print(f"❌ Failed to load image: {img_error}")
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(img_error)}")
        
        # Step 1: Object Detection (Food Detector)
        try:
            det_results = detector_model(img)
            detections = []
            
            if det_results and len(det_results) > 0 and len(det_results[0].boxes) > 0:
                for box in det_results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    cls = int(box.cls[0].cpu().numpy())
                    class_name = detector_model.names[cls]
                    
                    detections.append({
                        "bbox": [int(x1), int(y1), int(x2), int(y2)],
                        "confidence": conf,
                        "class": class_name
                    })
            print(f"✅ Detection complete: {len(detections)} objects found")
        except Exception as det_error:
            print(f"❌ Detection error: {det_error}")
            detections = []
        
        # Step 2: Food101 Classification
        try:
            food101_results = food101_model(img)
            food101_predictions = topk_from_probs(food101_results, k=5)
            print(f"✅ Food101 classification: {len(food101_predictions)} predictions")
        except Exception as f101_error:
            print(f"❌ Food101 error: {f101_error}")
            food101_predictions = []
        
        # Step 3: Filipino Food Classification
        try:
            filipino_results = filipino_model(img)
            filipino_predictions = topk_from_probs(filipino_results, k=5)
            print(f"✅ Filipino classification: {len(filipino_predictions)} predictions")
        except Exception as fil_error:
            print(f"❌ Filipino error: {fil_error}")
            filipino_predictions = []
        
        # ✅ Step 4: Ingredient Detection
        try:
            # ✅ LOWERED confidence threshold to 0.01 (1%) to detect more
            ingredients_results = ingredients_model(img, conf=0.01)
            ingredient_predictions = []
            
            if ingredients_results and len(ingredients_results) > 0 and len(ingredients_results[0].boxes) > 0:
                for box in ingredients_results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    cls = int(box.cls[0].cpu().numpy())
                    class_name = ingredients_model.names[cls]
                    
                    ingredient_predictions.append({
                        "name": class_name,
                        "confidence": conf,
                        "bbox": [int(x1), int(y1), int(x2), int(y2)]
                    })
            
            print(f"✅ Ingredients detection: {len(ingredient_predictions)} ingredients found")
        except Exception as ing_error:
            print(f"❌ Ingredients error: {ing_error}")
            traceback.print_exc()
            ingredient_predictions = []

        # ✅ NEW: Hybrid Logic
        max_conf = 0.0
        
        # Check Filipino model confidence
        if filipino_predictions:
            max_conf = max(max_conf, filipino_predictions[0]['confidence'])
            
        # Check Food101 model confidence
        if food101_predictions:
            max_conf = max(max_conf, food101_predictions[0]['confidence'])

        gemini_result = None
        
        # Threshold: If confidence is lower (TEMPORARY FOR TESTING), ask Gemini
        print(f"📊 Max confidence: {max_conf:.4f}")
        if max_conf < 1.0:
            print(f"📉 Low confidence ({max_conf:.2f}). Calling Gemini fallback...")
            gemini_result = call_gemini_vision(img)
        else:
            print(f"✅ High confidence ({max_conf:.2f}). Skipping Gemini.")
        
        return {
            "success": True,
            "detections": detections,
            "food101_predictions": food101_predictions,
            "filipino_predictions": filipino_predictions,
            "ingredient_predictions": ingredient_predictions,
            "gemini_prediction": gemini_result,
            "detection_count": len(detections)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Recognition error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recognize-food-combined")
async def recognize_food_combined(file: UploadFile = File(...)):
    """
    Combined endpoint - same as /recognize-food now!
    """
    return await recognize_food(file)

@app.post("/ocr/extract")
async def extract_text_from_image(file: UploadFile = File(...)):
    """Extract text from image using Tesseract OCR."""
    try:
        try:
            img = pil_from_upload(file)
            print(f"✅ Image loaded for OCR: {img.size}")
        except Exception as img_error:
            print(f"❌ Failed to load image: {img_error}")
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(img_error)}")
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # ✅ Test if Tesseract is accessible
        try:
            version = pytesseract.get_tesseract_version()
            print(f"✅ Tesseract version: {version}")
        except Exception as version_error:
            print(f"❌ Tesseract version check failed: {version_error}")
            raise HTTPException(status_code=500, detail=f"Tesseract not accessible: {str(version_error)}")
        
        text = pytesseract.image_to_string(img)
        
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        print(f"✅ OCR complete: {len(text)} characters extracted")
        
        return {
            "success": True,
            "text": text.strip(),
            "confidence": round(avg_confidence, 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ OCR error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

# FatSecret API Endpoints
@app.get("/fatsecret/foods/search")
async def search_foods(search_expression: str = Query(...)):
    try:
        result = call_server_api("foods.search", {"search_expression": search_expression})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fatsecret/food")
async def get_food(food_id: str = Query(...)):
    try:
        result = call_server_api("food.get", {"food_id": food_id})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fatsecret/barcode")
async def get_food_by_barcode(barcode: str = Query(...)):
    try:
        result = call_server_api("food.find_id_for_barcode", {"barcode": barcode})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fatsecret/qr")
async def get_food_by_qr(qr_code: str = Query(...)):
    try:
        result = call_server_api("food.find_id_for_barcode", {"barcode": qr_code})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ✅ Run the server
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FastAPI server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
