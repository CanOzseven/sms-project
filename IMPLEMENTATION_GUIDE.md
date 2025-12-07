# Ring Panel - Remaining Implementation Guide

This document outlines the remaining features requested and provides implementation guidance.

## ✅ Completed Features

1. **Branding**: Renamed "SMS Panel" to "Ring Panel" across all files
2. **Authentication Migration**: Changed from email to username-based authentication
3. **User Panel Features**:
   - Notification sound toggle (default ON)
   - Account settings modal
   - Password change functionality
4. **Admin Panel**: Removed Activity Logs tab from sidebar menu
5. **Test Script**: Created `backend/scripts/create-test-users.js` for test data

## 🚧 Pending Features

### 1. Fix Device Tab Selection Problem (User Panel)

**Issue**: Selected active tab state doesn't persist correctly when switching devices

**Implementation**:
```javascript
// In user-panel.html, update loadDevices function around line 937:
async function loadDevices() {
  try {
    const data = await api('/user/devices');
    devices = data.devices;

    const tabsContainer = document.getElementById('deviceTabs');
    tabsContainer.innerHTML = devices.map((device, index) => `
      <div class="device-tab ${(currentDevice && currentDevice.id === device.id) || (!currentDevice && index === 0) ? 'active' : ''}" data-device-id="${device.id}">
        <span class="device-status ${device.status}"></span>
        <span>${device.name}</span>
        ${device.unreadCount > 0 ? `<span class="unread-badge">${device.unreadCount}</span>` : ''}
      </div>
    `).join('');

    // Set first device as current if none selected
    if (devices.length > 0 && !currentDevice) {
      currentDevice = devices[0];
      loadConversations();
    }

    // Re-attach event listeners
    document.querySelectorAll('.device-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.device-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentDevice = devices.find(d => d.id === tab.dataset.deviceId);
        currentConversation = null;
        showEmptyState();
        loadConversations();
      });
    });
  } catch (error) {
    showToast(error.message, true);
  }
}
```

### 2. Delete Conversation Feature (User Panel)

**Location**: `sms-panel/frontend/user-panel.html`

**Backend API** (create in `backend/routes/user/sms.js`):
```javascript
/**
 * DELETE /api/user/sms/:deviceId/conversation/:phoneNumber
 * Konuşmayı sil
 */
router.delete('/:deviceId/conversation/:phoneNumber', verifyToken, checkDevicePermission, async (req, res) => {
  try {
    const { deviceId, phoneNumber } = req.params;

    // Delete all messages for this conversation
    const result = await SMS.deleteMany({
      deviceId,
      phoneNumber: decodeURIComponent(phoneNumber)
    });

    await logActivity(
      req.user._id,
      'CONVERSATION_DELETE',
      `Deleted conversation with ${phoneNumber}`,
      req,
      null,
      deviceId
    );

    res.json({
      success: true,
      message: 'Konuşma silindi',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});
```

**Frontend** (add delete button in conversation header):
```javascript
// In chat header, add delete button:
<button class="icon-btn" id="deleteConversationBtn" title="Konuşmayı Sil">🗑️</button>

// Add event listener:
document.getElementById('deleteConversationBtn')?.addEventListener('click', async () => {
  if (!confirm('Bu konuşmayı silmek istediğinize emin misiniz?')) return;

  try {
    await api(`/user/sms/${currentDevice.id}/conversation/${encodeURIComponent(currentConversation)}`, 'DELETE');
    showToast('Konuşma silindi');
    showEmptyState();
    currentConversation = null;
    loadConversations();
  } catch (error) {
    showToast(error.message, true);
  }
});
```

### 3. Auto-Refresh Toggle (Both Panels)

**User Panel** (add to settings modal):
```html
<!-- Already added in settings modal, just need to implement the logic -->
```

**JavaScript Implementation**:
```javascript
// Add after notification sound toggle initialization:
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
autoRefreshToggle.checked = localStorage.getItem('autoRefreshEnabled') !== 'false';
autoRefreshToggle.addEventListener('change', (e) => {
  localStorage.setItem('autoRefreshEnabled', e.target.checked);
  if (e.target.checked) {
    startPolling();
    showToast('Otomatik yenileme açıldı');
  } else {
    stopPolling();
    showToast('Otomatik yenileme kapatıldı');
  }
});

// Update startPolling to check preference:
function startPolling() {
  const autoRefreshEnabled = localStorage.getItem('autoRefreshEnabled') !== 'false';
  if (!autoRefreshEnabled) return;

  pollingInterval = setInterval(async () => {
    // existing polling code...
  }, 5000);
}
```

**Admin Panel**: Add similar toggle in top bar or create settings dropdown

### 4. Redesign Permissions Page (Admin Panel)

**Replace table with card-based layout**:

```javascript
// In loadPermissions function, change to:
async function loadPermissions() {
  try {
    const data = await api('/admin/permissions');

    // Group permissions by user
    const permissionsByUser = {};
    data.permissions.forEach(perm => {
      const userId = perm.userId?._id;
      if (!permissionsByUser[userId]) {
        permissionsByUser[userId] = {
          user: perm.userId,
          devices: []
        };
      }
      permissionsByUser[userId].devices.push(perm.deviceId);
    });

    const container = document.getElementById('permissionsTableBody').parentElement;
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 20px;">
        ${Object.values(permissionsByUser).map(item => `
          <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color);">
            <h4 style="margin-bottom: 16px; color: var(--accent-primary);">${item.user.username}</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${item.devices.map(device => `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-tertiary); border-radius: 8px;">
                  <span>${device.name}</span>
                  <button onclick="revokePermission('${item.user._id}', '${device._id}')" style="background: var(--danger); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;">&times;</button>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    showToast(error.message, true);
  }
}
```

### 5. Device Logout When Admin Deletes Device

**Backend** (update `backend/routes/admin/devices.js`):
```javascript
// In DELETE endpoint, add WebSocket or implement flag system:
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Mark device as deleted for Android app to detect
    device.status = 'deleted';
    device.deletedAt = new Date();
    await device.save();

    // Delete related data
    await Promise.all([
      SMS.deleteMany({ deviceId: device._id }),
      Permission.deleteMany({ deviceId: device._id })
    ]);

    // Finally delete device
    await Device.findByIdAndDelete(req.params.id);

    await logDeviceAction(req.user, 'DEVICE_DELETE', device, req);

    res.json({
      success: true,
      message: 'Cihaz ve ilgili veriler silindi'
    });
  } catch (error) {
    console.error('Device delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});
```

**Android App**: Check device status on heartbeat and logout if deleted

### 6. Daily SMS Cleanup Job

**Create** `backend/jobs/cleanupJobs.js`:
```javascript
const cron = require('node-cron');
const SMS = require('../models/SMS');

/**
 * Delete SMS messages older than 1 day
 */
async function cleanupOldSMS() {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result = await SMS.deleteMany({
      receivedAt: { $lt: oneDayAgo }
    });

    console.log(`🧹 Cleanup: Deleted ${result.deletedCount} SMS messages older than 1 day`);
  } catch (error) {
    console.error('❌ SMS Cleanup error:', error);
  }
}

/**
 * Schedule daily cleanup at midnight
 */
function startCleanupJobs() {
  // Run every day at 00:00
  cron.schedule('0 0 * * *', cleanupOldSMS);

  console.log('✅ Cleanup jobs scheduled (Daily at midnight)');
}

module.exports = { startCleanupJobs, cleanupOldSMS };
```

**Update** `backend/server.js`:
```javascript
const { startCleanupJobs } = require('./jobs/cleanupJobs');

// After server starts:
startCleanupJobs();
```

**Install** `node-cron`:
```bash
cd sms-panel/backend && npm install node-cron
```

### 7. Unified Login System

**Create** `frontend/login.html`:
```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <title>Ring Panel - Giriş</title>
  <!-- Same CSS as admin-panel.html login section -->
</head>
<body>
  <div class="login-container">
    <div class="login-box">
      <h1>Ring Panel</h1>
      <form id="loginForm">
        <input type="text" id="username" placeholder="Kullanıcı Adı" required>
        <input type="password" id="password" placeholder="Şifre" required>
        <button type="submit">Giriş Yap</button>
      </form>
    </div>
  </div>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
        // Try admin login first
        let response = await fetch('http://localhost:3000/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        let data = await response.json();

        if (response.ok) {
          localStorage.setItem('adminToken', data.token);
          window.location.href = 'admin-panel.html';
          return;
        }

        // Try user login
        response = await fetch('http://localhost:3000/api/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        data = await response.json();

        if (response.ok) {
          localStorage.setItem('userToken', data.token);
          window.location.href = 'user-panel.html';
        } else {
          alert(data.message);
        }
      } catch (error) {
        alert('Giriş hatası: ' + error.message);
      }
    });
  </script>
</body>
</html>
```

### 8. Single Session Management

**Add session tracking to User model**:
```javascript
// backend/models/User.js - add field:
sessionToken: {
  type: String,
  default: null
},
sessionCreatedAt: {
  type: Date,
  default: null
}
```

**Update login endpoints**:
```javascript
// In admin/auth.js and user/auth.js login routes:
// Before sending token response:
user.sessionToken = token;
user.sessionCreatedAt = new Date();
await user.save();
```

**Add middleware to check session**:
```javascript
// In middleware/auth.js, update verifyToken:
const decoded = jwt.verify(token, process.env.JWT_SECRET);
const user = await User.findById(decoded.userId);

if (!user || user.sessionToken !== token) {
  return res.status(401).json({
    success: false,
    message: 'Session expired. Please login again.'
  });
}
```

### 9. Development & Production Environment Setup

**Create** `backend/.env.development`:
```env
MONGODB_URI=mongodb://localhost:27017/ring-panel-dev
JWT_SECRET=dev-secret-key-change-in-production
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
LOG_LEVEL=debug
```

**Create** `backend/.env.production`:
```env
MONGODB_URI=mongodb://your-production-db-url/ring-panel
JWT_SECRET=your-super-secure-production-secret
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
```

**Update** `backend/package.json` scripts:
```json
{
  "scripts": {
    "start": "NODE_ENV=production node server.js",
    "dev": "NODE_ENV=development nodemon server.js",
    "test": "NODE_ENV=test node server.js"
  }
}
```

**Create environment loader** in `backend/config/env.js`:
```javascript
const path = require('path');
const dotenv = require('dotenv');

const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;

dotenv.config({ path: path.join(__dirname, '..', envFile) });

module.exports = {
  env,
  isDevelopment: env === 'development',
  isProduction: env === 'production',
  isTest: env === 'test'
};
```

### 10. File Logging System

**Install winston**:
```bash
cd backend && npm install winston winston-daily-rotate-file
```

**Create** `backend/config/logger.js`:
```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = process.env.LOG_DIR || '/var/log/ring-panel';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'activity-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      level: 'info'
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

**Use in code**:
```javascript
const logger = require('./config/logger');

logger.info('User logged in', { userId, username });
logger.error('Database connection failed', { error: error.message });
```

## 📝 Testing Instructions

1. **Create test users**:
   ```bash
   cd sms-panel/backend
   node scripts/create-test-users.js
   ```

2. **Test login**:
   - Username: `admin` / Password: `admin123` (Admin Panel)
   - Username: `testuser` / Password: `test123` (User Panel)

3. **Test features**:
   - Notification sound toggle in user panel settings
   - Password change in account settings
   - Device tab selection persistence
   - Auto-refresh toggle

## 🚀 Deployment Checklist

- [ ] Change default admin password
- [ ] Update JWT_SECRET in production
- [ ] Configure production MongoDB URI
- [ ] Set up log directory permissions (`mkdir -p /var/log/ring-panel && chmod 755 /var/log/ring-panel`)
- [ ] Set up CORS_ORIGIN to your domain
- [ ] Enable SSL/HTTPS
- [ ] Set up reverse proxy (nginx/Apache)
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure monitoring and alerts

## 📚 API Endpoints Summary

### Authentication
- `POST /api/admin/login` - Admin login
- `POST /api/user/login` - User login
- `GET /api/admin/me` - Get current admin
- `GET /api/user/me` - Get current user

### User Profile
- `GET /api/user/profile` - Get profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/profile/change-password` - Change password

### SMS Management
- `GET /api/user/sms/:deviceId/contacts` - Get conversations
- `GET /api/user/sms/:deviceId/conversation/:phone` - Get messages
- `PUT /api/user/sms/:deviceId/conversation/:phone/read-all` - Mark as read
- `DELETE /api/user/sms/:deviceId/conversation/:phone` - Delete conversation (to implement)

### Admin - Users
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

### Admin - Devices
- `GET /api/admin/devices` - List devices
- `POST /api/admin/devices` - Create device
- `PUT /api/admin/devices/:id` - Update device
- `DELETE /api/admin/devices/:id` - Delete device

### Admin - Permissions
- `GET /api/admin/permissions` - List permissions
- `POST /api/admin/permissions/grant` - Grant permission
- `DELETE /api/admin/permissions/revoke` - Revoke permission

## 🐛 Known Issues

1. Device tab selection may not persist when polling updates devices
2. No real-time updates (using polling instead of WebSockets)
3. No image/file sending support in messages
4. No message search functionality
5. No bulk message operations

## 💡 Future Enhancements

- WebSocket support for real-time updates
- Message search functionality
- Bulk operations (mark all as read, delete multiple)
- Export conversations
- SMS templates
- Scheduled messages
- Multi-language support
- Dark/light theme toggle
- Mobile app for iOS

---

**For questions or issues, refer to the documentation or create an issue in the repository.**

## 📱 Device Logout on Deletion (✅ IMPLEMENTED - Polling-based)

When an admin deletes a device from the admin panel, the Android app will automatically logout on its next API request.

### Backend Implementation

The backend has been updated to return a special error response when a device is not found:

```javascript
// In middleware/auth.js - deviceAuth middleware
if (!device) {
  return res.status(401).json({
    success: false,
    error: 'DEVICE_NOT_FOUND',
    message: 'Cihaz bulunamadı veya silindi. Lütfen yeniden giriş yapın.',
    requiresLogout: true
  });
}
```

### Android App Integration

**Required Changes in Android App:**

1. **Update API Response Handler:**

```kotlin
// In your API client or interceptor
fun handleApiResponse(response: Response): Result {
    if (response.code == 401) {
        val errorBody = response.errorBody()?.string()
        val error = Json.decodeFromString<ErrorResponse>(errorBody)

        if (error.requiresLogout == true || error.error == "DEVICE_NOT_FOUND") {
            // Device has been deleted, perform logout
            performDeviceLogout()
        }
    }
    // ... rest of error handling
}

data class ErrorResponse(
    val success: Boolean,
    val error: String?,
    val message: String?,
    val requiresLogout: Boolean? = false
)
```

2. **Implement Device Logout:**

```kotlin
private fun performDeviceLogout() {
    // Clear stored activation code
    sharedPreferences.edit()
        .remove("activation_code")
        .remove("device_id")
        .apply()

    // Stop background services
    stopSmsSync()

    // Navigate to login/activation screen
    val intent = Intent(this, ActivationActivity::class.java)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    startActivity(intent)

    // Show notification to user
    showToast("Cihazınız sistemden kaldırıldı. Lütfen yeniden aktivasyon yapın.")
}
```

3. **Handle in Sync Service:**

```kotlin
// In your SMS sync service
private fun syncMessages() {
    try {
        val response = apiClient.syncSMS(messages)
        if (response.isSuccessful) {
            // Handle success
        }
    } catch (e: HttpException) {
        if (e.code() == 401) {
            val errorBody = e.response()?.errorBody()?.string()
            val error = Json.decodeFromString<ErrorResponse>(errorBody)

            if (error.requiresLogout == true) {
                // Device deleted, stop service and logout
                stopSelf()
                sendLogoutBroadcast()
            }
        }
    }
}
```

### How It Works

1. **Admin deletes device** from admin panel (DELETE /api/admin/devices/:id)
2. **Device record is removed** from database
3. **On next API request** (SMS sync, heartbeat, etc.):
   - Android app sends activation code in header
   - Backend looks for device with that activation code
   - Device not found (deleted)
   - Backend returns `401` with `requiresLogout: true`
4. **Android app receives error:**
   - Detects `requiresLogout` flag
   - Clears local storage
   - Stops background services
   - Redirects to activation screen
   - Shows user-friendly message

### Testing

1. Activate a device in Android app
2. Login to admin panel
3. Delete the device from Devices page
4. Wait for next sync interval (or manually trigger sync)
5. Android app should automatically logout and show activation screen

### Notes

- No WebSocket required - uses existing polling mechanism
- Works with heartbeat, SMS sync, and any device API request
- Graceful degradation - app continues to function if offline
- User is informed about device removal
- Secure - activation code becomes invalid immediately

