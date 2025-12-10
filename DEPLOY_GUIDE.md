# Deploy Cloud Fire Alarm to the Internet

This guide will help you deploy your fire alarm system so it's accessible from anywhere.

## Option 1: Render.com (Recommended - Free)

### Step 1: Push Code to GitHub

1. Create a new repository on GitHub
2. Push the `cloud-alarm` folder:
```bash
cd cloud-alarm
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/cloud-alarm.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: cloud-alarm
   - **Root Directory**: backend
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

5. Add Environment Variables (click "Advanced" → "Add Environment Variable"):
   ```
   MONGODB_URI = mongodb+srv://bullet:hurts@cluster0.3gjfsqk.mongodb.net/cloud-alarm
   JWT_SECRET = 50554c10d36398a3edb06008c32c07d4
   GOOGLE_CLIENT_ID = 54342700040-h5v20qtu9pfehik2r8t0q2snbi4699db.apps.googleusercontent.com
   VAPID_PUBLIC_KEY = BPEhJu2txyMtJ5---RWoDa4n-O8MH8_a0A-YvCu23mpGVyAHk-dRsWYRNIUAAYaLfAd4hui6IarDaqTGt-3p7gA
   VAPID_PRIVATE_KEY = 7ut78CHJdKp0Dn8n7klcF11XyPeNbjq-pi9ffIzqBxY
   VAPID_EMAIL = mailto:angelonailon@gmail.com
   EMAIL_HOST = smtp.gmail.com
   EMAIL_PORT = 587
   EMAIL_USER = angelonailon@gmail.com
   EMAIL_PASS = ffei epic khtd axih
   FRONTEND_URL = https://cloud-alarm.onrender.com
   ```

6. Click "Create Web Service"
7. Wait for deployment (takes ~5 minutes)
8. Your app will be at: `https://cloud-alarm.onrender.com`

### Step 3: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Services → Credentials
3. Edit your OAuth 2.0 Client
4. Add to Authorized JavaScript origins:
   - `https://cloud-alarm.onrender.com`
5. Add to Authorized redirect URIs:
   - `https://cloud-alarm.onrender.com`

### Step 4: Update ESP32 Firmware

Update `cloud-alarm/esp32-mongo/config.h`:
```cpp
// For production (cloud deployment):
#define API_HOST "cloud-alarm.onrender.com"
#define API_PORT 443
#define USE_HTTPS true
```

Then re-upload to ESP32.

---

## Option 2: Railway.app (Easy)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Set Root Directory to `backend`
5. Add environment variables (same as above)
6. Deploy!

---

## After Deployment

Your system will work like this:
- ESP32 (any WiFi) → sends data to → Cloud Backend
- Phone/Browser (anywhere) → connects to → Cloud Backend
- Push notifications work globally

**Access your dashboard from anywhere:**
`https://your-app-name.onrender.com`

**ESP32 just needs internet access** - doesn't need to be on the same network as your phone!
