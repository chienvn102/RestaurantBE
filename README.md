# Restaurant POS - Backend API

Backend server cho hệ thống quản lý nhà hàng.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MariaDB 10.4.32
- **Real-time**: Socket.io
- **Cache**: Redis (optional)
- **Authentication**: JWT

## Cài Đặt

### 1. Cài dependencies

```bash
cd backend
npm install
```

### 2. Tạo database

```bash
# Import schema vào MariaDB qua phpMyAdmin hoặc:
mysql -u root -p < ../database-schema.sql
```

### 3. Cấu hình môi trường

```bash
# Copy file .env.example thành .env
cp .env.example .env

# Chỉnh sửa file .env với thông tin database của bạn
```

### 4. Chạy server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## API Endpoints

Tham khảo file `BACKEND.md` ở thư mục gốc để xem đầy đủ API documentation.

### Health Check

```bash
GET http://localhost:3000/health
```

## Structure

```
backend/
├── src/
│   ├── config/         # Database, Redis, etc.
│   ├── controllers/    # Request handlers
│   ├── routes/         # API routes
│   ├── models/         # Database models
│   ├── middleware/     # Auth, validation, etc.
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   └── server.js       # Entry point
├── logs/               # Application logs
├── uploads/            # File uploads
├── .env                # Environment variables
└── package.json
```

## Testing

```bash
npm test
```

## Deployment

Xem file `DEPLOYMENT.md` để biết hướng dẫn deploy production.
