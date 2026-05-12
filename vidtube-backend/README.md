# VidTube — YouTube-Inspired Backend API

A full-featured REST API backend built with Node.js, Express, and MongoDB/Mongoose. Covers user auth, video management, comments, likes, playlists, subscriptions, tweets, and a channel dashboard.

---

## Tech Stack

- **Runtime**: Node.js (ESM modules)
- **Framework**: Express v5
- **Database**: MongoDB + Mongoose
- **Auth**: JWT (access + refresh tokens)
- **File Uploads**: Multer + Cloudinary
- **Password Hashing**: bcrypt

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env` and fill in your values:

```env
PORT=7000
CORS_ORIGIN=*

MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net

ACCESS_TOKEN_SECRET=<random_secret>
ACCESS_TOKEN_EXPIRY=1d

REFRESH_TOKEN_SECRET=<random_secret>
REFRESH_TOKEN_EXPIRY=10d

CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>
```

### 3. Create temp upload folder
```bash
mkdir -p public/temp
```

### 4. Run
```bash
npm run dev      # development (nodemon)
npm start        # production
```

---

## API Reference

### Healthcheck
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/healthcheck` | Server health check |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/users/register` | — | Register (multipart: avatar, coverImage) |
| POST | `/api/v1/users/login` | — | Login |
| POST | `/api/v1/users/refresh-token` | — | Refresh access token |
| POST | `/api/v1/users/logout` | ✓ | Logout |
| POST | `/api/v1/users/change-password` | ✓ | Change password |
| GET | `/api/v1/users/current-user` | ✓ | Get current user |
| PATCH | `/api/v1/users/update-account` | ✓ | Update name/email |
| PATCH | `/api/v1/users/avatar` | ✓ | Update avatar |
| PATCH | `/api/v1/users/cover-image` | ✓ | Update cover image |
| GET | `/api/v1/users/c/:username` | ✓ | Get channel profile |
| GET | `/api/v1/users/history` | ✓ | Get watch history |

### Videos
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/videos` | Get all videos (paginated, filterable) |
| POST | `/api/v1/videos` | Upload video (multipart: videoFile, thumbnail) |
| GET | `/api/v1/videos/:videoId` | Get video by ID |
| PATCH | `/api/v1/videos/:videoId` | Update video |
| DELETE | `/api/v1/videos/:videoId` | Delete video |
| PATCH | `/api/v1/videos/toggle/publish/:videoId` | Toggle publish status |

### Tweets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tweets` | Create tweet |
| GET | `/api/v1/tweets/user/:userId` | Get user's tweets |
| PATCH | `/api/v1/tweets/:tweetId` | Update tweet |
| DELETE | `/api/v1/tweets/:tweetId` | Delete tweet |

### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/subscriptions/c/:channelId` | Get channel subscribers |
| POST | `/api/v1/subscriptions/c/:channelId` | Toggle subscribe |
| GET | `/api/v1/subscriptions/u/:subscriberId` | Get subscribed channels |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/comments/:videoId` | Get video comments |
| POST | `/api/v1/comments/:videoId` | Add comment |
| PATCH | `/api/v1/comments/c/:commentId` | Update comment |
| DELETE | `/api/v1/comments/c/:commentId` | Delete comment |

### Likes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/likes/toggle/v/:videoId` | Toggle video like |
| POST | `/api/v1/likes/toggle/c/:commentId` | Toggle comment like |
| POST | `/api/v1/likes/toggle/t/:tweetId` | Toggle tweet like |
| GET | `/api/v1/likes/videos` | Get liked videos |

### Playlists
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/playlist` | Create playlist |
| GET | `/api/v1/playlist/user/:userId` | Get user's playlists |
| GET | `/api/v1/playlist/:playlistId` | Get playlist by ID |
| PATCH | `/api/v1/playlist/:playlistId` | Update playlist |
| DELETE | `/api/v1/playlist/:playlistId` | Delete playlist |
| PATCH | `/api/v1/playlist/add/:videoId/:playlistId` | Add video to playlist |
| PATCH | `/api/v1/playlist/remove/:videoId/:playlistId` | Remove video from playlist |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/stats` | Channel stats (views, likes, subs, videos) |
| GET | `/api/v1/dashboard/videos` | All channel videos with stats |

---

## Authentication

The API uses **JWT Bearer tokens** + **httpOnly cookies**.

After login, the server sets `accessToken` and `refreshToken` as httpOnly cookies. For API clients that can't use cookies, pass the access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

When the access token expires, call `/api/v1/users/refresh-token` with the refresh token to get a new pair.

---

## Project Structure

```
src/
├── app.js                  # Express app setup + routes
├── index.js                # Entry point, DB connection
├── constants.js            # Shared constants (DB_NAME)
├── controllers/
│   ├── user.controller.js
│   ├── video.controller.js
│   ├── tweet.controller.js
│   ├── subscription.controller.js
│   ├── comment.controller.js
│   ├── like.controller.js
│   ├── playlist.controller.js
│   ├── dashboard.controller.js
│   └── healthcheck.controller.js
├── models/
│   ├── user.models.js
│   ├── video.models.js
│   ├── tweet.models.js
│   ├── subscription.models.js
│   ├── comment.models.js
│   ├── like.models.js
│   └── playlist.models.js
├── middlewares/
│   ├── auth.middleware.js  # JWT verification
│   └── multer.middleware.js
├── routes/
│   ├── user.routes.js
│   ├── video.routes.js
│   ├── tweet.routes.js
│   ├── subscription.routes.js
│   ├── comment.routes.js
│   ├── like.routes.js
│   ├── playlist.routes.js
│   ├── dashboard.routes.js
│   └── healthcheck.routes.js
├── utils/
│   ├── ApiError.js
│   ├── ApiResponse.js
│   ├── asyncHandler.js
│   └── cloudinary.js
└── db/
    └── index.js
```
