# GP Connect - Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GP CONNECT DEPLOYMENT ARCHITECTure               │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────┐
                                    │  USERS   │
                                    └────┬─────┘
                                         │
                                         ▼
                    ┌────────────────────────────────────┐
                    │                                    │
            ┌───────▼────────┐              ┌───────────▼──────────┐
            │   VERCEL       │              │   VERCEL CDN        │
            │   (Frontend)   │              │   (Static Assets)   │
            │                │              │                     │
            │  React + Vite  │              │  Images, CSS, JS    │
            └───────┬────────┘              └─────────────────────┘
                    │
                    │ HTTPS API Calls
                    │ WebSocket (Socket.io)
                    │
                    ▼
            ┌──────────────────────┐
            │   RENDER             │
            │   (Backend Server)   │
            │                      │
            │  Node.js + Express   │
            │  Socket.io Server    │
            └──────────┬───────────┘
                       │
           ┌───────────┼───────────┬─────────────┬──────────────┐
           │           │           │             │              │
           ▼           ▼           ▼             ▼              ▼
    ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  ┌───────────┐
    │ MongoDB  │ │Cloudinary│ │  Gmail   │ │  Redis   │  │   JWT     │
    │  Atlas   │ │ (Images) │ │ (Email)  │ │ (Cache)  │  │  (Auth)   │
    └──────────┘ └─────────┘ └──────────┘ └──────────┘  └───────────┘
```

---

## 📊 Component Breakdown

### 1. Frontend (Vercel)
**Technology Stack:**
- React 19.1.1
- Vite 7.1.7
- React Router v7
- Socket.io-client
- Axios
- Bootstrap + Tailwind CSS

**Key Features:**
- Server-side rendering (SSR) ready
- Automatic HTTPS
- Global CDN distribution
- Automatic deployments from Git
- Preview deployments for PRs
- Edge network optimization

**Environment Variables:**
```
VITE_API_BASE_URL → Points to Render backend
VITE_SOCKET_URL → WebSocket endpoint
VITE_CHAT_SECRET → End-to-end encryption key
```

---

### 2. Backend (Render)
**Technology Stack:**
- Node.js (ES Modules)
- Express 5.1.0
- Socket.io (WebSocket)
- MongoDB driver (Mongoose)
- JWT authentication
- Multer + Cloudinary

**Key Features:**
- RESTful API endpoints
- Real-time WebSocket connections
- JWT-based authentication
- File upload handling
- Email notifications
- Rate limiting
- Error handling middleware

**API Routes:**
```
/api/auth         → User authentication
/api/posts        → Post management
/api/profile      → User profiles
/api/community    → Communities
/api/conversations → Chat conversations
/api/messages     → Chat messages
/api/notifications → Real-time notifications
/api/health       → Health check endpoint
```

**Environment Variables:**
```
NODE_ENV → production
PORT → 5000
MONGO_URI → MongoDB Atlas connection
JWT_SECRET → Token signing secret
CHAT_SECRET → Message encryption
EMAIL_* → SMTP configuration
CLOUDINARY_* → Image service
CORS_ORIGIN → Allowed frontend URLs
```

---

### 3. Database (MongoDB Atlas)
**Configuration:**
- Cloud-hosted MongoDB
- Automated backups
- Scalable storage
- Security: IP whitelisting + authentication
- Global distribution available

**Collections:**
```
users → User accounts
posts → Social media posts
communities → Community groups
conversations → Chat rooms
messages → Chat messages
notifications → User notifications
users → User accounts
posts → Social media posts
communities → Community groups
conversations → Chat rooms
messages → Chat messages
notifications → User notifications
```

---

### 4. Cloud Storage (Cloudinary)
**Purpose:**
- Profile pictures
- Post images
- Community banners
- Media transformations

**Features:**
- Automatic image optimization
- CDN delivery
- Multiple format support
- Transformation API
- Secure URLs

---

### 5. Email Service (Gmail SMTP)
**Used For:**
- Registration verification
- Password reset
- Notifications (optional)

**Configuration:**
- SMTP: smtp.gmail.com:587
- TLS encryption
- App-specific password required

---

## 🔄 Data Flow

### User Registration Flow:
```
1. User submits form → Vercel Frontend
2. Frontend sends POST → Render Backend /api/auth/register
3. Backend validates → MongoDB (check existing user)
4. Backend creates user → MongoDB (save new user)
5. Backend sends email → Gmail SMTP
6. Backend returns JWT → Frontend stores token
7. Frontend redirects → Dashboard
```

### Real-time Chat Flow:
```
1. User opens chat → Frontend connects WebSocket to Render
2. Frontend sends auth token → Backend verifies JWT
3. Backend adds to Socket.io room → Redis (optional caching)
4. User sends message → Encrypted with CHAT_SECRET
5. Backend saves → MongoDB messages collection
6. Backend broadcasts → All room participants
7. Recipients decrypt → Display message
```

### Image Upload Flow:
```
1. User selects image → Frontend validates size/type
2. Frontend sends to → Backend /api/profile/upload
3. Backend processes → Multer middleware
4. Backend uploads → Cloudinary
5. Cloudinary returns URL → Backend saves to MongoDB
6. Backend responds → Frontend updates UI
7. Image served from → Cloudinary CDN
```

---

## 🔒 Security Layers

### 1. Transport Security
- ✅ HTTPS enforced (Vercel + Render)
- ✅ WSS for WebSockets
- ✅ TLS 1.2+ only

### 2. Authentication
- ✅ JWT tokens (HttpOnly recommended)
- ✅ bcrypt password hashing
- ✅ Token expiration
- ✅ Refresh token support (if implemented)

### 3. Authorization
- ✅ Role-based access control
- ✅ Community membership checks
- ✅ Resource ownership validation

### 4. Data Protection
- ✅ End-to-end chat encryption (CHAT_SECRET)
- ✅ Environment variable security
- ✅ MongoDB encryption at rest
- ✅ Secure headers (CSP, XSS protection)

### 5. Input Validation
- ✅ Express validator middleware
- ✅ File type validation
- ✅ Size limits enforced
- ✅ XSS prevention

### 6. Rate Limiting
- ✅ Express rate limiter
- ✅ API endpoint protection
- ✅ Login attempt limiting

---

## 📈 Scaling Considerations

### Current Setup (Free Tier):
```
Vercel:     100 GB bandwidth/month
Render:     750 hours/month (spins down after 15 min)
MongoDB:    512 MB storage
Cloudinary: 25 GB storage, 25 GB bandwidth
```

### When to Scale:

**Upgrade Render ($7/month):**
- More than 100 concurrent users
- Need always-on service
- Response time > 2 seconds

**Upgrade MongoDB:**
- Storage > 500 MB
- Need automated backups
- Require performance analytics

**Upgrade Cloudinary:**
- Image storage > 20 GB
- Bandwidth > 20 GB/month
- Need advanced transformations

**Add Redis:**
- Session management needed
- Caching for performance
- Pub/sub for Socket.io scaling

---

## 🚀 Performance Optimizations

### Frontend (Already Implemented):
✅ Code splitting (vendor, router, icons)
✅ Lazy loading
✅ Image optimization
✅ Minification (Terser)
✅ Tree shaking
✅ CDN delivery

### Backend (Already Implemented):
✅ Express rate limiting
✅ CORS optimization
✅ Error handling middleware
✅ Database indexing
✅ Connection pooling

### Recommended Additions:
- [ ] Implement Redis caching
- [ ] Add service worker (PWA)
- [ ] Enable compression (gzip)
- [ ] Add monitoring (Sentry)
- [ ] Implement lazy image loading
- [ ] Add database query optimization

---

## 📊 Monitoring & Analytics

### Vercel Analytics:
- Page views
- Unique visitors
- Performance metrics
- Deployment history

### Render Metrics:
- CPU usage
- Memory usage
- Response times
- Error rates
- Request logs

### MongoDB Atlas:
- Connection count
- Query performance
- Storage usage
- Operation metrics

### Custom Logging:
- Console logs (already implemented)
- Error tracking
- User activity logs
- API request logs

---

## 🔄 CI/CD Pipeline

```
Developer Workflow:

1. Code locally → Test locally
2. git commit → git push to main
3. GitHub webhook → Triggers deployments
4. Render build → npm install → npm start
5. Vercel build → npm install → npm run build
6. Automated tests → (if configured)
7. Deploy to production
8. Health checks → Verify deployment
```

**Deployment Triggers:**
- Push to `main` branch → Production
- Pull requests → Preview environments (Vercel)
- Manual deploy → Dashboard button

---

## 🌍 Geographic Distribution

### Current Setup:
```
Frontend (Vercel):
├── Edge Network: Global CDN
└── Deploy Region: Auto (closest to most users)

Backend (Render):
├── Region: Select on deployment
│   ├── Oregon (US West)
│   ├── Ohio (US East)
│   ├── Frankfurt (Europe)
│   └── Singapore (Asia)
└── Choose based on user location

Database (MongoDB Atlas):
├── Primary Region: Choose closest to backend
└── Read Replicas: Optional for global apps
```

---

## 💰 Cost Breakdown (Monthly)

### Free Tier (Testing):
```
Vercel:      $0 (Hobby plan)
Render:      $0 (Free plan, 750 hours)
MongoDB:     $0 (M0 cluster, 512 MB)
Cloudinary:  $0 (Free tier)
Gmail SMTP:  $0 (Gmail account)
─────────────────────────────
Total:       $0/month
```

### Production (Small Scale):
```
Vercel Pro:     $20/month
Render Starter: $7/month
MongoDB M10:    $57/month (2GB RAM, 10GB storage)
Cloudinary:     $0 (likely still within free tier)
─────────────────────────────
Total:          ~$84/month
```

### Production (Medium Scale):
```
Vercel Pro:     $20/month
Render Pro:     $25/month (2GB RAM)
MongoDB M20:    $89/month (4GB RAM, 20GB storage)
Cloudinary:     $89/month (100GB, 100GB bandwidth)
Redis Cloud:    $5/month (30MB)
─────────────────────────────
Total:          ~$228/month
```

---

## 🎯 Best Practices Checklist

### Code Quality:
- [x] ES6+ modern JavaScript
- [x] Modular code structure
- [x] Error handling
- [x] Input validation
- [ ] Unit tests (recommended)
- [ ] Integration tests (recommended)

### Security:
- [x] Environment variables for secrets
- [x] HTTPS/WSS only
- [x] JWT authentication
- [x] Password hashing
- [x] CORS configuration
- [x] Rate limiting

### Performance:
- [x] Code splitting
- [x] Lazy loading
- [x] Image optimization
- [x] Database indexing
- [ ] Caching (Redis recommended)
- [ ] Compression (recommended)

### Reliability:
- [x] Error logging
- [x] Graceful error handling
- [x] Database connection retry
- [ ] Health check endpoints
- [ ] Uptime monitoring (recommended)
- [ ] Automated backups (MongoDB Atlas)

### User Experience:
- [x] Responsive design
- [x] Loading states
- [x] Error messages
- [x] Real-time updates
- [ ] Offline support (PWA recommended)
- [ ] Accessibility (WCAG recommended)

---

## 🔧 Troubleshooting Guide

### Common Issues Matrix:

| Issue | Symptom | Check | Fix |
|-------|---------|-------|-----|
| CORS Error | API calls blocked | CORS_ORIGIN env var | Update with Vercel URL |
| Socket.io fails | Chat not working | VITE_SOCKET_URL | Verify Render URL |
| Images broken | 404 on images | Cloudinary config | Check credentials |
| DB connection | Server won't start | MONGO_URI | Verify connection string |
| Slow first load | 30-60s delay | Render free tier | Normal, or upgrade |
| Build fails | Deployment error | Build logs | Check dependencies |
| 404 on routes | Page not found | vercel.json | Ensure rewrites configured |
| Auth not working | Can't login | JWT_SECRET | Verify secret set |

---

## 📚 Additional Resources

### Official Documentation:
- [Vercel Docs](https://vercel.com/docs)
- [Render Docs](https://render.com/docs)
- [MongoDB Atlas Docs](https://www.mongodb.com/docs/atlas/)
- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Socket.io Docs](https://socket.io/docs/)
- [Express.js Docs](https://expressjs.com/)
- [React Docs](https://react.dev/)

### Community Resources:
- Stack Overflow
- GitHub Issues
- Discord/Slack communities
- Reddit r/webdev

---

**Architecture Version:** 1.0  
**Last Updated:** October 25, 2025  
**Maintained By:** GP Connect Team
