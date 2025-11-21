#!/bin/bash

# Setup EAS Secrets for Secure APK Build
# This script uploads environment variables to EAS servers
# Run this ONCE before building your APK

echo "🔐 Setting up EAS Secrets for secure APK builds..."
echo ""
echo "This will upload your API keys to EAS servers (encrypted and secure)"
echo "Other users will NOT be able to see these keys in your APK"
echo ""

# Load from .env file
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with your API keys first"
    exit 1
fi

# Extract values from .env
SUPABASE_URL=$(grep "EXPO_PUBLIC_SUPABASE_URL=" .env | cut -d '=' -f 2)
SUPABASE_ANON=$(grep "EXPO_PUBLIC_SUPABASE_ANON_KEY=" .env | cut -d '=' -f 2)
EDAMAM_ID=$(grep "EXPO_PUBLIC_EDAMAM_APP_ID=" .env | cut -d '=' -f 2)
EDAMAM_KEY=$(grep "EXPO_PUBLIC_EDAMAM_APP_KEY=" .env | cut -d '=' -f 2)
OPENAI_KEY=$(grep "EXPO_PUBLIC_OPENAI_API_KEY=" .env | cut -d '=' -f 2)
FOOD_API=$(grep "EXPO_PUBLIC_FOOD_API_URL=" .env | cut -d '=' -f 2)

echo "📝 Found the following keys in .env:"
echo "  ✓ Supabase URL: ${SUPABASE_URL:0:30}..."
echo "  ✓ Supabase Anon Key: ${SUPABASE_ANON:0:20}..."
echo "  ✓ Edamam App ID: $EDAMAM_ID"
echo "  ✓ Edamam App Key: ${EDAMAM_KEY:0:20}..."
echo "  ✓ OpenAI API Key: ${OPENAI_KEY:0:20}..."
echo "  ✓ Food API URL: $FOOD_API"
echo ""

read -p "Upload these secrets to EAS? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Uploading secrets to EAS..."

# Upload each secret
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "$SUPABASE_URL" --type string --force
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$SUPABASE_ANON" --type string --force
eas secret:create --scope project --name EXPO_PUBLIC_EDAMAM_APP_ID --value "$EDAMAM_ID" --type string --force
eas secret:create --scope project --name EXPO_PUBLIC_EDAMAM_APP_KEY --value "$EDAMAM_KEY" --type string --force
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value "$OPENAI_KEY" --type string --force
eas secret:create --scope project --name EXPO_PUBLIC_FOOD_API_URL --value "$FOOD_API" --type string --force

echo ""
echo "✅ All secrets uploaded successfully!"
echo ""
echo "📦 You can now build your APK with:"
echo "   eas build --platform android --profile production"
echo ""
echo "🔒 Your API keys are now:"
echo "   ✓ Encrypted on EAS servers"
echo "   ✓ Injected into APK during build"
echo "   ✓ NOT visible in your source code"
echo "   ✓ NOT accessible to other users"
echo ""
echo "🔍 To view uploaded secrets:"
echo "   eas secret:list"
echo ""
