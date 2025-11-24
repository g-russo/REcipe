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
import json
import base64
import re

# ✅ Load .env file FIRST
load_dotenv()

# ✅ EXPLICITLY SET TESSERACT PATH FOR LINUX
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# FatSecret API credentials
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
FATSECRET_KEY = os.getenv("FATSECRET_CLIENT_ID", "")
FATSECRET_SECRET = os.getenv("FATSECRET_CLIENT_SECRET", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

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
        print("⚠️ Gemini Rate Limit Reached. Switching to OpenAI Fallback...")
        return call_openai_vision(image)

    if not gemini_model:
        print("❌ gemini_model is None. Switching to OpenAI Fallback...")
        return call_openai_vision(image)

    prompt = """
    You are an expert food recognizer with deep knowledge of Filipino cuisine and plating conventions.

        Task: Analyze the provided image and return a structured JSON object containing a top-level "predictions" array. For each prediction include both a short identification and detailed, sectioned reasoning.

        For each candidate prediction include these fields:
        - name: short dish or ingredient name (e.g., "Chicken Pastil", "Adobo Flakes"). Use "Not a Food" or "Unknown Food" when appropriate.
        - confidence: numeric score between 0.0 and 0.99.
        - defining_dish: key visual elements that define the dish (e.g., banana leaf, mound of white rice, shredded meat, garnishes).
        - confirming_cuisine: why the cuisine (e.g., Filipino) was chosen; list visual clues and context.
        - identifying_dish: concise argument for this dish including cultural/contextual notes (origin, common usage).
        - plating_variations: notes about presentation variations (banana leaf, pater wrap, liner) and whether observed plating is traditional or modern.
        - verifying_meat: observations about the protein (chicken/pork/tuna) and confidence in that assertion.
        - alternatives: up to 2 plausible alternative identifications and brief reason.
        - reason: a short human-readable justification summarizing the strongest clues.

        Requirements:
        1) Prioritize Filipino dishes when cues indicate Filipino cooking, but return international names if clearly non-Filipino.
        2) If the image is NOT food intended for human consumption (pet food, fertilizer, labels only), return a single prediction with "name": "Not a Food" and include a "reason" explaining why.
        3) If the item cannot be identified, return "Unknown Food" with a low confidence and a short explanation.
        4) Return up to 5 predictions sorted by confidence. Keep the JSON compact and free of extra commentary.

        Example output:
        {
            "predictions": [
                {
                    "name": "Chicken Pastil",
                    "confidence": 0.87,
                    "defining_dish": "Banana leaf liner, mound of white rice, shredded brown meat with green onions",
                    "confirming_cuisine": "Banana leaf presentation and shredded meat common in Southern Filipino dishes (Maguindanao)",
                    "identifying_dish": "Matches Chicken Pastil: shredded chicken served on rice on banana leaf; traditional to Maguindanao",
                    "plating_variations": "Often wrapped in 'pater' or served on a leaf as a liner; modern plating may omit wrap",
                    "verifying_meat": "Appears to be shredded chicken; texture and color consistent though tuna/pork possible",
                    "alternatives": ["Adobo Flakes"],
                    "reason": "Banana leaf + shredded meat + rice strongly suggest Pastil"
                }
            ]
        }
    """
    
    try:
        print("⏳ Sending request to Gemini...")
        response = gemini_model.generate_content(
            [prompt, image],
            generation_config={"response_mime_type": "application/json"}
        )
        print(f"✅ Gemini Raw Response: {response.text}")
        import json
        parsed = json.loads(response.text)

        # Normalize to a list of predictions (backwards compatible)
        preds = []
        if isinstance(parsed, dict) and 'predictions' in parsed and isinstance(parsed['predictions'], list):
            preds = parsed['predictions']
        elif isinstance(parsed, list):
            preds = parsed
        elif isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    preds = v
                    break

        # Post-process predictions: if the model indicates the item is packaged/not prepared food
        # attempt to infer whether the contents are edible and suggest usages (e.g., canned sardines)
        def augment_prediction(p):
            try:
                # Safely access fields and lowercase a text blob for heuristics
                name = (p.get('name') or '').lower() if isinstance(p, dict) else ''
                text_blob = ' '.join([str(p.get(k, '')) for k in ('defining_dish', 'identifying_dish', 'reason', 'confirming_cuisine') if isinstance(p, dict)])
                text_blob = text_blob.lower()

                packaging_keywords = ['can', 'canned', 'tin', 'packet', 'jar', 'bottle', 'pack', 'packaged', 'label', 'container']
                contents_usable = False
                for kw in packaging_keywords:
                    if kw in text_blob:
                        contents_usable = True
                        break

                # Try to extract likely food item names from the textual fields (simple keyword matching)
                food_regex = r'\b(sardines|sardine|tuna|beans|tomato|sauce|peanut butter|peanut|corn|salmon|mackerel|soup|chicken|beef|pork|tuna)\b'
                food_matches = re.findall(food_regex, text_blob)
                # normalize matches
                usable_items = []
                for m in food_matches:
                    m_clean = m.strip().lower()
                    if m_clean and m_clean not in usable_items:
                        usable_items.append(m_clean)

                if name == 'not a food' or name == 'unknown food' or contents_usable or usable_items:
                    p['contents_usable'] = True
                    suggestions = []
                    if usable_items:
                        # Provide simple recipe suggestions based on the first matched item
                        first = usable_items[0]
                        if 'sardin' in first or 'tuna' in first or 'mackerel' in first or 'salmon' in first:
                            suggestions = [f"{first.title()} Pasta", f"{first.title()} Fried Rice", f"{first.title()} Sandwich"]
                        elif 'beans' in first or 'corn' in first:
                            suggestions = ["Add to salad", "Make a bean stew", "Mix into fried rice"]
                        elif 'tomato' in first or 'sauce' in first:
                            suggestions = ["Use as pasta sauce", "Add to stews", "Use in soup"]
                        elif 'chicken' in first or 'beef' in first or 'pork' in first:
                            suggestions = ["Shred and add to fried rice", "Use in sandwich", "Incorporate into pasta"]
                        else:
                            suggestions = ["Use contents as ingredient in pasta, fried rice, or sandwiches"]
                    else:
                        suggestions = ["Inspect packaging and use contents as ingredient if edible (pasta, fried rice, salad)"]

                    p['usable_as'] = suggestions
                else:
                    p['contents_usable'] = False

                return p
            except Exception:
                return p

        preds = [augment_prediction(p) for p in preds]
        return preds
    except Exception as e:
        print(f"❌ Gemini Error: {e}")
        traceback.print_exc()
        print("⚠️ Gemini Failed. Switching to OpenAI Fallback...")
        return call_openai_vision(image)

def encode_image(image: Image.Image):
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def call_openai_vision(image: Image.Image):
    """
    Fallback to OpenAI GPT-4o Vision when Gemini rate limit is reached.
    """
    if not OPENAI_API_KEY:
        print("❌ OpenAI API Key missing for fallback")
        return None
        
    print("🤖 Calling OpenAI Vision (Fallback)...")
    
    try:
        base64_image = encode_image(image)
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        prompt_text = """
You are an expert food recognizer with deep knowledge of Filipino cuisine and plating conventions.

Task: Analyze the provided image and return a structured JSON object with a top-level "predictions" array. Each prediction must include both a concise identification and detailed, sectioned reasoning.

For each prediction include these fields:
- name: short dish or ingredient name (e.g., "Chicken Pastil"). Use "Not a Food" or "Unknown Food" when appropriate.
- confidence: numeric score between 0.0 and 0.99.
- defining_dish: key visual elements that define the dish (banana leaf, rice mound, shredded meat, garnishes).
- confirming_cuisine: why the cuisine (e.g., Filipino) was chosen; visual clues and contextual reasoning.
- identifying_dish: concise argument for this dish including cultural/contextual notes (origin, common usage).
- plating_variations: notes about presentation variations (banana leaf, pater wrap, liner) and whether observed plating is traditional or modern.
- verifying_meat: observations about the protein (chicken/pork/tuna) and confidence in that assertion.
- alternatives: up to 2 plausible alternative identifications and brief reason.
- reason: a short human-readable summary of the strongest clues.

Requirements:
1) Prioritize Filipino dishes when cues indicate Filipino cooking, but return international names if clearly non-Filipino.
2) If the image is NOT food intended for human consumption (pet food, fertilizer, labels-only), return a single prediction with "name": "Not a Food" and include a "reason" explaining why.
3) If the item cannot be identified, return "Unknown Food" with low confidence and a short explanation.
4) Return up to 5 predictions sorted by confidence. Keep the JSON compact; do not include extra commentary.

Example response:
{
    "predictions": [
        {
            "name": "Chicken Pastil",
            "confidence": 0.87,
            "defining_dish": "Banana leaf liner, mound of white rice, shredded brown meat with green onions",
            "confirming_cuisine": "Banana leaf presentation and shredded meat common in Southern Filipino dishes (Maguindanao)",
            "identifying_dish": "Matches Chicken Pastil: shredded chicken served on rice on banana leaf; traditional to Maguindanao",
            "plating_variations": "Often wrapped in 'pater' or served on a leaf as a liner; modern plating may omit wrap",
            "verifying_meat": "Appears to be shredded chicken; texture suggests poultry though tuna/pork possible",
            "alternatives": ["Adobo Flakes"],
            "reason": "Banana leaf + shredded meat + rice strongly suggest Pastil"
        }
    ]
}
"""
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt_text
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "response_format": { "type": "json_object" },
            "max_tokens": 500
        }
        
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"❌ OpenAI Error: {response.status_code} - {response.text}")
            return None
            
        result = response.json()
        content = result['choices'][0]['message']['content']
        print(f"✅ OpenAI Raw Response: {content}")
        
        data = json.loads(content)
        return data.get("predictions", [])
    except Exception as e:
        print(f"❌ OpenAI Fallback Error: {e}")
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
    """Extract text from image using Tesseract OCR with Gemini AI fallback."""
    try:
        try:
            img = pil_from_upload(file)
            print(f"✅ Image loaded for OCR: {img.size}")
        except Exception as img_error:
            print(f"❌ Failed to load image: {img_error}")
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(img_error)}")
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # ✅ Try Tesseract first
        tesseract_text = None
        tesseract_confidence = 0
        
        try:
            version = pytesseract.get_tesseract_version()
            print(f"✅ Tesseract version: {version}")
            
            text = pytesseract.image_to_string(img)
            
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            # ✅ FIX: Only use Tesseract if we got meaningful text
            if text.strip() and len(text.strip()) > 5:
                tesseract_text = text.strip()
                tesseract_confidence = round(avg_confidence, 2)
                print(f"✅ Tesseract OCR complete: {len(tesseract_text)} characters")
            else:
                print(f"⚠️ Tesseract found minimal text, trying AI fallback...")
                
        except Exception as tesseract_error:
            print(f"⚠️ Tesseract failed: {tesseract_error}")
        
        # ✅ If Tesseract failed or gave low confidence, try Gemini
        if not tesseract_text or tesseract_confidence < 60:
            print("🔄 Falling back to Gemini AI for OCR...")
            
            gemini_text = call_gemini_ocr(img)
            
            if gemini_text and gemini_text != "No text found":
                return {
                    "success": True,
                    "text": gemini_text,
                    "confidence": 95.0,
                    "source": "gemini"
                }
            else:
                # ✅ Final fallback to OpenAI
                print("🔄 Gemini failed, trying OpenAI...")
                openai_text = call_openai_ocr(img)
                
                if openai_text and openai_text != "No text found":
                    return {
                        "success": True,
                        "text": openai_text,
                        "confidence": 95.0,
                        "source": "openai"
                    }
        
        # ✅ Return Tesseract result if we have it
        if tesseract_text:
            return {
                "success": True,
                "text": tesseract_text,
                "confidence": tesseract_confidence,
                "source": "tesseract"
            }
        else:
            raise HTTPException(status_code=500, detail="All OCR methods failed to extract text")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ OCR error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

def call_gemini_ocr(image: Image.Image):
    """
    Use Gemini AI to extract text from image (OCR fallback).
    """
    print("✨ call_gemini_ocr triggered")
    
    # ✅ Check Rate Limit
    if not check_gemini_rate_limit():
        print("⚠️ Gemini Rate Limit Reached. Switching to OpenAI Fallback...")
        return call_openai_ocr(image)

    if not gemini_model:
        print("❌ gemini_model is None. Switching to OpenAI Fallback...")
        return call_openai_ocr(image)

    prompt = """
    Extract ALL visible text from this image.
    
    Instructions:
    1. Return ONLY the extracted text, exactly as it appears.
    2. Preserve line breaks and formatting.
    3. If the text is a list (e.g., shopping list, ingredients), keep each item on a new line.
    4. Do NOT add any explanations, summaries, or additional commentary.
    5. If no text is found, return "No text found".
    
    Example:
    If the image shows:
    ```
    Eggs
    Milk
    Bread
    Chicken
    ```
    
    Return exactly:
    ```
    Eggs
    Milk
    Bread
    Chicken
    ```
    """
    
    try:
        print("⏳ Sending OCR request to Gemini...")
        response = gemini_model.generate_content([prompt, image])
        text = response.text.strip()
        print(f"✅ Gemini OCR Response: {text[:100]}...")
        return text
    except Exception as e:
        print(f"❌ Gemini OCR Error: {e}")
        traceback.print_exc()
        print("⚠️ Gemini Failed. Switching to OpenAI Fallback...")
        return call_openai_ocr(image)

def call_openai_ocr(image: Image.Image):
    """
    Fallback to OpenAI GPT-4o Vision for OCR when Gemini rate limit is reached.
    """
    if not OPENAI_API_KEY:
        print("❌ OpenAI API Key missing for fallback")
        return None
        
    print("🤖 Calling OpenAI Vision for OCR (Fallback)...")
    
    try:
        base64_image = encode_image(image)
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        prompt_text = """
        Extract ALL visible text from this image.
        
        Instructions:
        1. Return ONLY the extracted text, exactly as it appears.
        2. Preserve line breaks and formatting.
        3. If the text is a list (e.g., shopping list, ingredients), keep each item on a new line.
        4. Do NOT add any explanations, summaries, or additional commentary.
        5. If no text is found, return "No text found".
        """
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt_text
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 1000
        }
        
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"❌ OpenAI OCR Error: {response.status_code} - {response.text}")
            return None
            
        result = response.json()
        text = result['choices'][0]['message']['content'].strip()
        print(f"✅ OpenAI OCR Response: {text[:100]}...")
        return text
    except Exception as e:
        print(f"❌ OpenAI OCR Fallback Error: {e}")
        traceback.print_exc()
        return None

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

# Dish Deconstruction Endpoint
class DeconstructRequest(BaseModel):
    food_name: str

@app.post("/deconstruct-dish")
async def deconstruct_dish(request: DeconstructRequest):
    # ✅ Check Rate Limit
    if not check_gemini_rate_limit():
        print("⚠️ Gemini Rate Limit Reached for deconstruct-dish. Using fallback.")
        return call_openai_deconstruct(request.food_name)

    if not gemini_model:
        print("❌ Gemini AI not available. Using fallback.")
        return call_openai_deconstruct(request.food_name)
    
    prompt = f"""
    Analyze the food item: "{request.food_name}".
    
    1. Is this a cooked dish/leftover or a raw ingredient?
    2. If it is a dish (especially a Filipino dish), list the main salvageable ingredients that could be repurposed into another meal.
    3. If it is a raw ingredient, just return the ingredient name.
    4. Suggest 3-5 creative recipe names that can be made using these leftovers or ingredients.
    
    Format the output as a JSON object with these keys:
    - is_dish: boolean
    - ingredients: list of strings (the salvageable ingredients or the raw ingredient itself. Keep them simple and concise, e.g., "cooked pork" instead of "cooked meat (pork, beef...)")
    - suggested_recipes: list of strings (names of recipes to make with these)
    - reasoning: string (brief explanation)
    
    Example 1:
    Input: "Adobo"
    Output: {{ 
        "is_dish": true, 
        "ingredients": ["cooked chicken", "cooked pork", "adobo sauce"], 
        "suggested_recipes": ["Adobo Flakes", "Adobo Fried Rice", "Adobo Sandwich"],
        "reasoning": "Adobo meat can be flaked and fried or used in sandwiches." 
    }}
    
    Example 2:
    Input: "Tomato"
    Output: {{ 
        "is_dish": false, 
        "ingredients": ["tomato"], 
        "suggested_recipes": ["Tomato Soup", "Tomato Salsa", "Stuffed Tomatoes"],
        "reasoning": "It is a raw ingredient." 
    }}
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        text = response.text
        # Clean up markdown code blocks if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
            
        return json.loads(text)
    except Exception as e:
        print(f"Error deconstructing dish: {e}")
        print("⚠️ Gemini Failed. Switching to OpenAI Fallback...")
        return call_openai_deconstruct(request.food_name)

def call_openai_deconstruct(food_name: str):
    """
    Fallback to OpenAI GPT-4o for dish deconstruction when Gemini rate limit is reached.
    """
    if not OPENAI_API_KEY:
        print("❌ OpenAI API Key missing for fallback")
        return {
            "is_dish": False,
            "ingredients": [food_name],
            "reasoning": "AI service unavailable (Rate limit reached & no fallback key)."
        }
        
    print(f"🤖 Calling OpenAI Deconstruction (Fallback) for: {food_name}...")
    
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        prompt_text = f"""
        Analyze the food item: "{food_name}".
        
        1. Is this a cooked dish/leftover or a raw ingredient?
        2. If it is a dish (especially a Filipino dish), list the main salvageable ingredients that could be repurposed into another meal.
        3. If it is a raw ingredient, just return the ingredient name.
        4. Suggest 3-5 creative recipe names that can be made using these leftovers or ingredients.
        
        Format the output as a JSON object with these keys:
        - is_dish: boolean
        - ingredients: list of strings (the salvageable ingredients or the raw ingredient itself. Keep them simple and concise, e.g., "cooked pork" instead of "cooked meat (pork, beef...)")
        - suggested_recipes: list of strings (names of recipes to make with these)
        - reasoning: string (brief explanation)
        
        Example 1:
        Input: "Adobo"
        Output: {{ 
            "is_dish": true, 
            "ingredients": ["cooked chicken", "cooked pork", "adobo sauce"], 
            "suggested_recipes": ["Adobo Flakes", "Adobo Fried Rice", "Adobo Sandwich"],
            "reasoning": "Adobo meat can be flaked and fried or used in sandwiches." 
        }}
        
        Example 2:
        Input: "Tomato"
        Output: {{ 
            "is_dish": false, 
            "ingredients": ["tomato"], 
            "suggested_recipes": ["Tomato Soup", "Tomato Salsa", "Stuffed Tomatoes"],
            "reasoning": "It is a raw ingredient." 
        }}
        """
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": prompt_text
                }
            ],
            "response_format": { "type": "json_object" },
            "max_tokens": 500
        }
        
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"❌ OpenAI Error: {response.status_code} - {response.text}")
            return {
                "is_dish": False,
                "ingredients": [food_name],
                "reasoning": "OpenAI fallback failed."
            }
            
        result = response.json()
        content = result['choices'][0]['message']['content']
        print(f"✅ OpenAI Raw Response: {content}")
        
        return json.loads(content)
    except Exception as e:
        print(f"❌ OpenAI Fallback Error: {e}")
        traceback.print_exc()
        return {
            "is_dish": False,
            "ingredients": [food_name],
            "reasoning": "Error in OpenAI fallback."
        }

# ✅ Run the server
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FastAPI server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
