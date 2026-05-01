# SSES Portal — Testing Guide

## Pre-requisites
- Server chal raha ho (`node server.js`)
- Admin panel browser me khula ho (`http://localhost:5173`)
- Android phone me debug APK install ho
- Phone aur PC ek hi network pe ho (ya server production pe ho)

---

## TEST 1 — Accuracy Threshold Filter

**Kya test karna hai:** Weak GPS reading reject ho

**Steps:**
1. Phone ko andar (indoor) le jao — GPS weak hoga
2. App open karo — location service start hogi
3. 2-3 minute baad Admin Panel → Attendance → Live Tracking tab kholo
4. Us user ka timeline dekho

**Expected Result:**
- Indoor me koi ping nahi aani chahiye (ya bahut kam)
- Console/Logcat me `skipped: true, reason: low_accuracy` dikhna chahiye
- Outdoor jaane par pings aani chahiye

**Pass Criteria:** Indoor me 0-1 ping, outdoor me regular pings ✅

---

## TEST 2 — Mock Location Detection

**Kya test karna hai:** Fake GPS detect ho aur attendance block ho

**Steps:**
1. Play Store se "Fake GPS Location" app install karo
2. Phone Settings → Developer Options → Mock Location App → Fake GPS select karo
3. Fake GPS app me koi location set karo (jaise Delhi)
4. SSES app open karo
5. Notification check karo
6. Admin Panel → Attendance → Live Tracking → us user ka log dekho
7. App me attendance mark karne ki koshish karo

**Expected Result:**
- Phone pe notification aani chahiye: "⚠️ Fake Location Detected!"
- Admin panel me us user ka log `status: mock` dikhna chahiye
- Attendance mark karne par error: "Attendance blocked: Fake location detected"

**Pass Criteria:** Notification aai + attendance block hui ✅

---

## TEST 3 — Speed Anomaly Detection (Server Side)

**Kya test karna hai:** Teleport/impossible speed detect ho

**Steps (Postman ya curl se):**
```
# Pehle ek normal location bhejo
POST /api/attendance/location
{ "lat": 22.563, "lng": 76.961, "accuracy": 10, "status": "ok", "timestamp": <now_ms> }

# 30 second baad Mumbai ki location bhejo (1000+ km door)
POST /api/attendance/location
{ "lat": 19.076, "lng": 72.877, "accuracy": 10, "status": "ok", "timestamp": <now+30s_ms> }
```

**Expected Result:**
- Doosri request ka response: `{ ok: true, reason: 'speed_anomaly' }`
- MongoDB me `status: 'mock', isMock: true` wala log bana ho

**Pass Criteria:** speed_anomaly response aaya ✅

---

## TEST 4 — Adaptive Ping Interval

**Kya test karna hai:** Ruke hue = 15 min, chalte hue = 5 min

**Steps:**
1. Phone ko ek jagah rakh do (bahar, GPS clear ho)
2. App start karo
3. 5-6 minute observe karo — pings ka gap dekho
4. Gaadi me baithke 500m+ move karo
5. Phir pings ka gap dekho

**Expected Result:**
- Ruke hue: pings 15 minute ke gap pe
- Chalte hue: pings 5 minute ke gap pe
- Admin Panel → Live Tracking → Timeline me timestamps ka gap check karo

**Pass Criteria:** Gap clearly different dono situations me ✅

---

## TEST 5 — Offline Queue

**Kya test karna hai:** Network nahi toh pings store ho, online aane par bhejo

**Steps:**
1. Phone ko Airplane Mode me daalo
2. 10-15 minute wait karo (2-3 ping cycles)
3. Admin Panel → Live Tracking → us user ke logs dekho (koi naya nahi aana chahiye)
4. Airplane Mode hatao
5. 1-2 minute wait karo
6. Admin Panel → Live Tracking → logs refresh karo

**Expected Result:**
- Airplane mode me: koi naya log nahi
- Online aane ke baad: stored pings ek saath aa jaayein

**Pass Criteria:** Offline pings online aane par dikh gayi ✅

---

## TEST 6 — WebSocket Real-time (Campus Map)

**Kya test karna hai:** Admin panel bina refresh ke update ho

**Steps:**
1. Admin Panel → Attendance → Campus Map tab kholo
2. Map pe markers dekho
3. Phone se app open karo (location service chal rahi ho)
4. Kuch minute wait karo ya manually ping trigger karo
5. Admin panel ka map dekho — bina refresh kiye

**Expected Result:**
- Jab phone se ping aaye — map pe marker turant move ho
- Page refresh karne ki zaroorat na pade
- Browser console me `location:update` socket event dikhna chahiye

**Pass Criteria:** Map real-time update hua bina refresh ke ✅

---

## TEST 7 — Analytics Tab

**Kya test karna hai:** Daily distance, weekly table, inactive alert

### 7A — Daily Distance
1. Admin Panel → Attendance → Analytics tab kholo
2. Aaj ki date select karo
3. "Refresh" button dabao

**Expected:** Har user ka naam, km, pings count, first/last ping time dikhna chahiye

### 7B — Weekly Distance Table
1. Same Analytics tab me neeche scroll karo
2. Last 7 din ka table dikhna chahiye
3. Color coding check karo: green (50+ km), amber (20-50), red (<20)

**Expected:** Table me saare users ke 7 din ka data dikhna chahiye

### 7C — Inactive Alert
1. Kisi user ki last ping 3+ ghante purani honi chahiye (ya aaj koi ping nahi)
2. Analytics tab refresh karo
3. Working hours me ho (7AM-7PM, Mon-Sat)

**Expected:** Red alert box dikhna chahiye us user ka naam aur "Last seen X min ago"

**Pass Criteria:** Teeno sections data dikha raha hai ✅

---

## TEST 8 — Inactive Cron Notification

**Kya test karna hai:** Admin ko notification mile jab koi 3+ ghante inactive ho

**Steps:**
1. Kisi user ki last ping 3+ ghante purani karo
2. Server me manually cron trigger karo (ya 1 ghanta wait karo):
```bash
# Server console me test ke liye temporarily:
node -e "require('./controllers/analyticsController').runInactiveCheck()"
```
3. Admin Panel → Notifications check karo

**Expected:** "X Track Incharge Inactive" notification aani chahiye

**Pass Criteria:** Notification aayi ✅

---

## TEST 9 — Full Flow End-to-End

**Kya test karna hai:** Poora system ek saath

**Steps:**
1. Track incharge phone pe app open karo
2. Location permission "Always Allow" do
3. Battery optimization off karo (app prompt karega)
4. Bahar jao — GPS clear area
5. 5-10 minute walk karo
6. Admin Panel → Analytics → Daily Distance dekho
7. Admin Panel → Live Tracking → Timeline dekho
8. Admin Panel → Campus Map dekho

**Expected:**
- Daily Distance me distance dikh rahi ho
- Timeline me route dikh raha ho map pe
- Campus Map me marker sahi jagah ho

**Pass Criteria:** Poora flow kaam kar raha hai ✅

---

## Common Issues aur Fix

| Issue | Cause | Fix |
|---|---|---|
| Campus Map socket connect nahi | CORS ya wrong URL | `VITE_API_URL` check karo `.env` me |
| Analytics data nahi aa raha | Route register nahi | Server restart karo |
| Pings nahi aa rahe | Battery optimization on | App me "Disable Battery Optimization" button dabao |
| Mock detect nahi ho raha | Developer options me mock app set nahi | Settings → Developer Options → Select mock location app |
| Offline queue kaam nahi | Network check | `pending_pings` SharedPreferences me manually check karo |

---

## Build Commands Quick Reference

```bash
# Server start
cd server && node server.js

# Web build + Android sync
cd client && npm run build && npx cap sync android

# Debug APK
cd client/android && gradlew assembleDebug
# APK: client/android/app/build/outputs/apk/debug/app-debug.apk

# Release APK (signed)
cd client/android && gradlew assembleRelease
# APK: client/android/app/release/app-release.apk
```

---

## Postman Collection — Location API Tests

### 1. Save Normal Location
```
POST {{base_url}}/api/attendance/location
Authorization: Bearer {{token}}
{
  "lat": 22.563246,
  "lng": 76.961334,
  "accuracy": 15,
  "status": "ok",
  "timestamp": {{$timestamp}}000
}
```

### 2. Save Mock Location
```
POST {{base_url}}/api/attendance/location
Authorization: Bearer {{token}}
{
  "status": "mock",
  "timestamp": {{$timestamp}}000
}
```

### 3. Get Daily Distance
```
GET {{base_url}}/api/analytics/daily-distance?date=2025-07-10
Authorization: Bearer {{admin_token}}
```

### 4. Get Inactive Users
```
GET {{base_url}}/api/analytics/inactive-now
Authorization: Bearer {{admin_token}}
```

### 5. Get Weekly Distance
```
GET {{base_url}}/api/analytics/weekly-distance
Authorization: Bearer {{admin_token}}
```
