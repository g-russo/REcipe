import os
from pathlib import Path
import io
import time
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import pytesseract
from ultralytics import YOLO
import torch

# Load models at startup
device = 'cuda' if torch.cuda.is_available() else 'cpu'
detector_model = YOLO('models/best.pt').to(device)
food101_model = YOLO('models/food101_cls_best.pt').to(device)
filipino_model = YOLO('models/filipino_cls_best.pt').to(device)

app = FastAPI(title="REcipe API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "ok": True,
        "models": {
            "detector": True,
            "cls_main": True,
            "cls_fil": True,
        },
    }

def pil_from_upload(upload: UploadFile) -> Image.Image:
    b = upload.file.read()
    if not b:
        raise HTTPException(400, "Empty image")
    try:
        return Image.open(io.BytesIO(b)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image")

def topk_from_probs(res, k: int):
    # res: Ultralytics classification result (res.probs, res.names)
    items: List[TopKItem] = []
    try:
        probs = res.probs.data
        if hasattr(probs, "cpu"):
            probs = probs.cpu()
        if hasattr(probs, "numpy"):
            probs = probs.numpy()
        vals = [(int(i), float(p)) for i, p in enumerate(probs)]
        vals.sort(key=lambda x: x[1], reverse=True)
        names = res.names if hasattr(res, "names") else {}
        for idx, p in vals[:k]:
            label = names[idx] if isinstance(names, dict) and idx in names else str(idx)
            items.append(TopKItem(label=label, conf=p))
    except Exception:
        pass
    return items

@app.post("/recognize-food")
async def recognize_food(file: UploadFile = File(...)):
    """
    Food recognition endpoint combining detector + classifiers
    """
    try:
        start_time = time.time()
        
        # Read and prepare image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # 1. Detector (best.pt) - find food objects
        detector_results = detector_model(image, conf=0.25)
        detections = []
        
        for r in detector_results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                class_name = detector_model.names[cls]
                
                detections.append({
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "confidence": conf,
                    "label": class_name,
                    "class_id": cls
                })
        
        # 2. Food101 classifier - top-k predictions
        food101_results = food101_model(image)
        food101_topk = []
        
        if food101_results and len(food101_results) > 0:
            probs = food101_results[0].probs
            if probs is not None:
                top5_indices = probs.top5
                top5_conf = probs.top5conf.tolist()
                
                for idx, conf in zip(top5_indices, top5_conf):
                    food101_topk.append({
                        "label": food101_model.names[idx],
                        "conf": conf,
                        "class_id": int(idx)
                    })
        
        # 3. Filipino classifier - top-k predictions
        filipino_topk = []
        filipino_results = filipino_model(image)
        
        if filipino_results and len(filipino_results) > 0:
            probs = filipino_results[0].probs
            if probs is not None:
                top5_indices = probs.top5
                top5_conf = probs.top5conf.tolist()
                
                for idx, conf in zip(top5_indices, top5_conf):
                    filipino_topk.append({
                        "label": filipino_model.names[idx],
                        "conf": conf,
                        "class_id": int(idx)
                    })
        
        # Determine global class (highest confidence across all models)
        global_class = None
        global_conf = 0.0
        global_source = None
        
        if food101_topk and food101_topk[0]["conf"] > global_conf:
            global_conf = food101_topk[0]["conf"]
            global_class = food101_topk[0]["label"]
            global_source = "food101"
        
        if filipino_topk and filipino_topk[0]["conf"] > global_conf:
            global_conf = filipino_topk[0]["conf"]
            global_class = filipino_topk[0]["label"]
            global_source = "filipino"
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return {
            "success": True,
            "detections": detections,
            "food101_topk": food101_topk,
            "filipino_topk": filipino_topk,
            "global_class": global_class,
            "global_conf": global_conf,
            "global_class_source": global_source,
            "model": "YOLOv8 ensemble",
            "device": device,
            "elapsed_ms": elapsed_ms
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "detections": [],
            "food101_topk": [],
            "filipino_topk": []
        }

@app.post("/ocr/extract")
async def ocr_extract_text(file: UploadFile = File(...)):
    """Extract text from image using OCR (Tesseract)."""
    try:
        img = pil_from_upload(file)
        
        # Use Tesseract OCR to extract text
        text = pytesseract.image_to_string(img, lang='eng')
        
        # Clean up text
        text = text.strip()
        
        return {
            "success": True,
            "text": text,
            "length": len(text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

# ============================================================================
# FatSecret API Endpoints
# ============================================================================

@app.get("/fatsecret/foods/search")
def fs_foods_search(q: str, page: int = Query(0, ge=0), max_results: int = Query(20, ge=1, le=50)):
    """Search for foods by text query."""
    try:
        result = call_server_api(
            "foods.search",
            {"search_expression": q, "page_number": page, "max_results": max_results},
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FatSecret search failed: {e}")

@app.get("/fatsecret/food")
def fs_food_get(food_id: int = Query(..., alias="id")):
    """Get detailed food information by food_id."""
    try:
        result = call_server_api("food.get.v2", {"food_id": food_id})
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FatSecret food.get failed: {e}")

@app.get("/fatsecret/barcode")
async def fatsecret_barcode(barcode: str = Query(...)):
    """Lookup food by barcode."""
    try:
        # ✅ Use call_server_api (not fatsecret_client object)
        result = call_server_api("food.find_id_for_barcode", {"barcode": barcode})
        if not result or "error" in result:
            return {"error": {"message": "Barcode not found"}}
        
        # If barcode found, get full food details
        food_id = result.get("food_id", {}).get("value")
        if food_id:
            food_details = call_server_api("food.get.v2", {"food_id": food_id})
            return {"food": food_details.get("food", {})}
        
        return {"error": {"message": "Invalid barcode response"}}
    except Exception as e:
        return {"error": {"message": str(e)}}

@app.get("/fatsecret/qr")
async def fatsecret_qr(qr_code: str = Query(...)):
    """Lookup food by QR code."""
    try:
        result = call_server_api("food.find_id_for_qr", {"qr_code": qr_code})
        if not result or "error" in result:
            return {"error": {"message": "QR code not found"}}
        
        # If QR found, get full food details
        food_id = result.get("food_id", {}).get("value")
        if food_id:
            food_details = call_server_api("food.get.v2", {"food_id": food_id})
            return {"food": food_details.get("food", {})}
        
        return {"error": {"message": "Invalid QR code response"}}
    except Exception as e:
        return {"error": {"message": str(e)}}
