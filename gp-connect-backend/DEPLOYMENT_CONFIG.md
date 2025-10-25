# Deployment Configuration Guide

## Environment Variables Setup

### Required Cloudinary Variables
The following environment variables must be configured in your deployment environment:

```bash
# Cloudinary Configuration (REQUIRED)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Platform-Specific Configuration

#### Heroku Deployment
```bash
# Set environment variables using Heroku CLI
heroku config:set CLOUDINARY_CLOUD_NAME=your-cloud-name
heroku config:set CLOUDINARY_API_KEY=your-api-key
heroku config:set CLOUDINARY_API_SECRET=your-api-secret

# Or via Heroku Dashboard:
# 1. Go to your app dashboard
# 2. Navigate to Settings tab
# 3. Click "Reveal Config Vars"
# 4. Add each variable
```

#### Netlify Functions
```bash
# In netlify.toml or Netlify Dashboard
[build.environment]
  CLOUDINARY_CLOUD_NAME = "your-cloud-name"
  CLOUDINARY_API_KEY = "your-api-key"
  CLOUDINARY_API_SECRET = "your-api-secret"
```

#### Vercel Deployment
```bash
# Using Vercel CLI
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET

# Or via Vercel Dashboard:
# Project Settings > Environment Variables
```

#### Railway Deployment
```bash
# Using Railway CLI
railway variables set CLOUDINARY_CLOUD_NAME=your-cloud-name
railway variables set CLOUDINARY_API_KEY=your-api-key
railway variables set CLOUDINARY_API_SECRET=your-api-secret
```

#### Docker Deployment
```dockerfile
# In docker-compose.yml
environment:
  - CLOUDINARY_CLOUD_NAME=your-cloud-name
  - CLOUDINARY_API_KEY=your-api-key
  - CLOUDINARY_API_SECRET=your-api-secret

# Or using .env file with docker-compose
env_file:
  - .env
```

## Build Configuration

### Package.json Scripts
Ensure these scripts are available for deployment:

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "npm install",
    "migrate:run": "node scripts/migrateImages.js migrate",
    "migrate:status": "node scripts/migrateImages.js status"
  }
}
```

### Procfile (Heroku)
```
web: npm start
```

### Build Commands
```bash
# Install dependencies
npm install

# Run migration (if needed)
npm run migrate:status
npm run migrate:run

# Start application
npm start
```

## Security Configuration

### Environment Variable Validation
The application validates required Cloudinary variables on startup:

```javascript
// Validated in services/cloudinaryService.js
const requiredVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY', 
  'CLOUDINARY_API_SECRET'
];
```

### CORS Configuration
Ensure CORS is properly configured for your frontend domain:

```javascript
// In server.js
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
};
```

## Health Checks

### Cloudinary Connection Test
```bash
# Test Cloudinary connection
curl -X GET https://your-api.com/api/health/cloudinary
```

### Image Upload Test
```bash
# Test image upload endpoint
curl -X POST https://your-api.com/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@test-image.jpg" \
  -F "content=Test post"
```

## Monitoring Setup

### Required Monitoring Endpoints
- `/api/health/cloudinary` - Cloudinary connection status
- `/api/monitoring/image-performance` - Image performance metrics
- `/api/monitoring/storage-usage` - Storage usage statistics

### Logging Configuration
Ensure proper logging for production:

```javascript
// Environment-based logging
const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'debug';
```

## Rollback Plan

### Emergency Fallback
If Cloudinary fails, the application includes fallback mechanisms:

1. **Graceful Degradation**: New uploads fall back to local storage
2. **Error Handling**: Existing images continue to work
3. **Monitoring**: Alerts for Cloudinary failures

### Rollback Steps
```bash
# 1. Revert to previous deployment
git revert <commit-hash>

# 2. Redeploy without Cloudinary
# Remove Cloudinary environment variables

# 3. Restore local image handling
# Previous multer configuration will be used
```

## Performance Optimization

### CDN Configuration
Cloudinary provides automatic CDN delivery. No additional configuration needed.

### Caching Headers
```javascript
// Automatic via Cloudinary
// Images cached with optimal headers
```

### Image Optimization
```javascript
// Automatic transformations applied:
// - Format optimization (WebP when supported)
// - Size optimization (1000x1000 max)
// - Quality optimization (auto)
```