# Backend

Node.js/Express REST API server for the Web GIS Dashboard.

## Technologies

- **Node.js** — JavaScript runtime
- **Express** — Web application framework
- **Mongoose** — MongoDB object modeling (ODM)
- **dotenv** — Environment variable management

## Directory Structure (planned)

```
backend/
├── src/
│   ├── config/       # App & database configuration
│   ├── controllers/  # Route controllers / handlers
│   ├── middleware/    # Custom Express middleware
│   ├── models/       # Mongoose schemas & models
│   ├── routes/       # API route definitions
│   ├── services/     # Business logic layer
│   ├── utils/        # Utility functions
│   └── app.js        # Express app setup
├── .env.example      # Environment variable template
├── server.js         # Entry point
└── package.json
```

## Setup

```bash
npm install
npm run dev
```
