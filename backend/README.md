# REcipe Backend - Food Recognition & FatSecret API

This backend provides:
1. **Food Recognition** using YOLO models (detector, Food101, Filipino classifiers)
2. **FatSecret API Proxy** for nutrition data, barcode/QR lookup

## Local Development Setup

### Prerequisites
- Python 3.10+
- Virtual environment

### Installation

```bash
cd backend

# Create and activate venv
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1

# Linux/Mac
source .venv/bin/activate

# Install PyTorch (CPU)
python -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio

# Install dependencies
python -m pip install -r requirements.txt
```

### Configuration

Create a `.env` file in the backend folder or set environment variables:

```bash
# FatSecret API credentials
FATSECRET_CLIENT_ID=your_client_id
FATSECRET_CLIENT_SECRET=your_client_secret
```

Get FatSecret credentials at: https://platform.fatsecret.com/api/

### Run Locally

```bash
python -m uvicorn api:app --host 0.0.0.0 --port 5001 --reload
```

Test:
```bash
curl http://localhost:5001/health
```

## API Endpoints

### Health Check
```
GET /health
```

### Food Recognition
```
POST /recognize?k=5
Content-Type: multipart/form-data
Body: file=<image>

Response:
{
  "model": "ultralytics",
  "device": "cpu",
  "elapsed_ms": 1234.5,
  "detections": [...],
  "global_class": "pizza",
  "global_conf": 0.95,
  "main_topk": [...],
  "fil_topk": [...]
}
```

### FatSecret - Search Foods
```
GET /fatsecret/foods/search?q=apple&page=0&max_results=20

Response: FatSecret foods.search JSON
```

### FatSecret - Get Food Details
```
GET /fatsecret/food?id=12345

Response: FatSecret food.get.v2 JSON
```

### FatSecret - Barcode Lookup
```
GET /fatsecret/barcode?barcode=042100005264

Response:
{
  "food_id": {
    "value": "12345"
  }
}
```

### FatSecret - QR Code Lookup
```
GET /fatsecret/qr?code=<qr_data>

Response: Same as barcode
```

## Models

Place YOLO model weights in `backend/models/`:
- `best.pt` - Object detector
- `food101_cls_best.pt` - Food101 classifier
- `filipino_cls_best.pt` - Filipino food classifier

## Production Deployment

See [AWS_DEPLOYMENT_GUIDE.md](../AWS_DEPLOYMENT_GUIDE.md) for complete EC2 setup instructions.

## Frontend Integration

Update your `.env`:
```bash
# Local development
EXPO_PUBLIC_FOOD_API_URL=http://10.0.2.2:5001  # Android emulator
# or
EXPO_PUBLIC_FOOD_API_URL=http://192.168.x.x:5001  # Physical device

# Production
EXPO_PUBLIC_FOOD_API_URL=https://api.yourapp.com
```

Use the service:
```javascript
import { classifyImageAsync } from './services/food-recog-api';
import { searchFoods, lookupBarcode } from './services/fatsecret-service';

// Food recognition
const result = await classifyImageAsync(imageUri);

// Search foods
const foods = await searchFoods('chicken');

// Lookup barcode
const foodData = await lookupBarcode('042100005264');
```

## Troubleshooting

**"Module not found" errors:**
- Ensure venv is activated
- Reinstall: `python -m pip install -r requirements.txt`

**"Network request failed" from app:**
- Check backend is running on 0.0.0.0:5001
- Use correct IP (10.0.2.2 for emulator, LAN IP for device)
- Check Windows Firewall allows port 5001

**"FatSecret authentication failed":**
- Verify FATSECRET_CLIENT_ID and SECRET are set
- Test credentials: https://platform.fatsecret.com/api/

**Slow inference:**
- Use GPU instance on EC2
- Reduce image size before upload
- Consider model quantization
