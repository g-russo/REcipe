# Quick Security Fix Script
# Run this before building APK

echo "🔒 REcipe APK Security Setup"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    exit 1
fi

echo "📝 Step 1: Checking for security vulnerabilities..."

# Check for exposed keys
if grep -q "OPENAI_API_KEY" .env; then
    echo "⚠️  WARNING: OpenAI API Key found in .env"
    echo "   This key will be EXPOSED in the APK!"
    echo "   Solution: Move to Supabase Edge Functions"
fi

if grep -q "SERVICE_ROLE_KEY" .env; then
    echo "⚠️  WARNING: Service Role Key found in .env"
    echo "   This bypasses ALL database security!"
    echo "   Solution: Remove from client, use only in Edge Functions"
fi

echo ""
echo "📋 Security Checklist:"
echo ""
echo "[ ] Move OpenAI calls to Edge Functions"
echo "[ ] Remove OPENAI_API_KEY from .env"
echo "[ ] Remove SERVICE_ROLE_KEY from client"
echo "[ ] Deploy Python backend separately"
echo "[ ] Test Edge Functions work"
echo "[ ] Enable RLS on all tables"
echo ""
echo "See APK_SECURITY_GUIDE.md for detailed steps!"
echo ""
echo "🚨 DO NOT BUILD APK UNTIL THESE ARE FIXED!"
