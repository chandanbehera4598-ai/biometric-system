# Smart Biometric Attendance (Node.js + Express)

## Easiest way to run

1) Open terminal in this folder and install:

```bash
npm install
```

2) Start the server:

```bash
npm start
```

3) Open in browser:

- `http://localhost:3001`

## How it works

- Valid attendance slots:
  - 09:00–09:15
  - 11:00–11:15
  - 14:00–14:15
  - 16:00–16:15
  - 18:00–18:15
- First 5 minutes of any slot → **On Time**
- Remaining minutes inside the slot → **Late**
- Outside all slots → **Absent**

## API

- `POST /attendance`
  - Body (optional): `{ "userId": "u-001", "name": "Student" }`
  - Response: `{ status, present, slot, time, record }`

- `GET /attendance/today`
  - Returns today’s in-memory attendance records.

## Notes

- Records are stored in an in-memory array in `server.js`, so they reset when you stop/restart the server.

