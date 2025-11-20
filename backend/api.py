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

# ✅ Load .env file FIRST
load_dotenv()

# FatSecret API credentials
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
FATSECRET_KEY = os.getenv("FATSECRET_CLIENT_ID", "")
FATSECRET_SECRET = os.getenv("FATSECRET_CLIENT_SECRET", "")

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

detector_model = YOLO('models/best.pt').to(device)
food101_model = YOLO('models/food101_cls_best.pt').to(device)
filipino_model = YOLO('models/filipino_cls_best.pt').to(device)
ingredients_model = YOLO('models/ingredients_best.pt').to(device)

print("✅ All models loaded successfully!")

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
        
        # Step 1: Object Detection
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
        
        # ✅ Step 4: Ingredient Detection (ADDED!)
        try:
            ingredients_results = ingredients_model(img)
            ingredient_predictions = topk_from_probs(ingredients_results, k=10)
            print(f"✅ Ingredients classification: {len(ingredient_predictions)} predictions")
        except Exception as ing_error:
            print(f"❌ Ingredients error: {ing_error}")
            ingredient_predictions = []
        
        return {
            "success": True,
            "detections": detections,
            "food101_predictions": food101_predictions,
            "filipino_predictions": filipino_predictions,
            "ingredient_predictions": ingredient_predictions,  # ✅ ADDED!
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
