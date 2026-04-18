# Database

MongoDB configuration, schemas, and seed data for the Web GIS Dashboard.

## Technologies

- **MongoDB** — NoSQL document database
- **Mongoose** — ODM for MongoDB

## Directory Structure (planned)

```
database/
├── config/       # MongoDB connection configuration
├── migrations/   # Database migration scripts
├── seeds/        # Seed data for development & testing
├── schemas/      # Schema documentation / validation rules
└── README.md     # This file
```

## MongoDB Setup

### Local Installation

1. Install MongoDB Community Edition
2. Start the MongoDB service
3. Configure connection string in backend `.env`

### MongoDB Atlas (Cloud)

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Whitelist your IP address
3. Create a database user
4. Copy the connection string to backend `.env`
