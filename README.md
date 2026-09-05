# Q-Pass College Canteen Pre-Ordering & Fast Pickup System

Q-Pass is a modern, responsive web application designed to eliminate college canteen queues. It enables students to pre-order food, holds inventory temporarily during checkout to prevent double-ordering, and generates secure QR-code receipts for instant counter collection.

The system includes a **Zero-Setup Database Fallback**. If you do not have PostgreSQL installed, the system automatically detects this and falls back to a persistent local JSON-file database (`src/db/mockdb.json`). **No database installation, Docker setup, or seed scripts are required to start using it immediately!**

---

## System Overview & Views

The application provides four dedicated interfaces accessible from the top navigation bar:

1. **Student Terminal (Pre-Ordering)**:
   - Browse catalog items filtered by categories (Breakfast, Snacks, Lunch, Beverages).
   - Place items in the cart (automatically locking stock for 10 minutes to prevent checkout race conditions).
   - Complete checkout with a simulated UPI/Card payment gateway.
   - Access the receipt drawer to view QR code tickets with live collection status.

2. **Staff Terminal (Canteen Admin)**:
   - View real-time pending, paid, and completed order queues.
   - Adjust daily inventory levels, online stock allocations, and close/open ordering.
   - Access canteen configuration settings (operating hours, counter PIN code lock).

3. **Scanner Terminal (Pickup Simulation)**:
   - Simulates the physical QR code scanner at the canteen counter.
   - Enter or scan the QR token hash from the student's receipt to mark orders as "SERVED" and update inventory states instantly.

4. **Mentor / Lab Diagnostics Terminal**:
   - View application system logs, connection states, and check schema tables health check tests.

---

## Application Preview

### Student Pre-Ordering Catalog Grid
![Canteen home page screenshot](./public/screenshots/home_page.png)

### Category Filtering (Breakfast Selected)
![Breakfast filtered view](./public/screenshots/breakfast_filtered.png)

---

## Foolproof Installation & Running Guide

Follow these exact steps to run the application on your computer:

### Step 1: Install Node.js
Ensure you have **Node.js** installed (version 18, 20, or higher).
- You can download it from [nodejs.org](https://nodejs.org/).
- Verify it is installed by running this command in your terminal/cmd:
  ```bash
  node -v
  ```

### Step 2: Install Project Dependencies
Open your command prompt (cmd), terminal, or PowerShell in the project directory and run:
```bash
npm install
```
*This downloads and installs all necessary Next.js, React, Tailwind, and database driver packages.*

### Step 3: Start the Next.js Server
Run the following command to start the application:
```bash
npm run dev
```
You will see output indicating that the server is ready:
`▲ Next.js 16.2.6 (Turbopack)`
`- Local: http://localhost:3000`

### Step 4: Open in Web Browser
Open your web browser (Chrome, Edge, Firefox, or Safari) and go to:
[**http://localhost:3000**](http://localhost:3000)

The application will load instantly with seeded canteen items (Veggies puff, dosa, coffee,Keema roll, Keema puff, executive veg thali, chai) and high-quality images.

---

## Connecting a PostgreSQL Database (Optional)

If you want to run this application with a real PostgreSQL database instead of the default local mock database fallback, follow these steps:

### Step 1: Create a PostgreSQL Database
- Install PostgreSQL on your computer.
- Open your database client (e.g. pgAdmin, psql) and create a database named `app_db`.

### Step 2: Configure Environment Variables
Create a file named `.env` in the root directory of the project and add your database credentials in the following format:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/app_db
```
*(Replace `postgres` and `password` with your actual PostgreSQL username and password).*

### Step 3: Run Database Migrations
Push the database schema tables to your PostgreSQL instance by running:
```bash
npx drizzle-kit push
```

### Step 4: Start the Server
Run `npm run dev`. The database proxy will detect the active PostgreSQL connection on port 5432, connect to it, initialize the tables, and seed the default menu items catalog automatically.

### Optional Backend and Mentor Configuration

For production, configure a non-default staff PIN in the database and set:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/app_db
QPASS_MOCK_DB_PATH=./src/db/mockdb.json
```

The Mentor backend endpoint is available at `POST /api/mentor/ask`. To enable an OpenAI-compatible provider, add these server-only variables:

```env
OPENAI_API_KEY=your-server-side-key
OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
```

Without an API key, the endpoint provides local diagnostic guidance. Never expose `OPENAI_API_KEY` through `NEXT_PUBLIC_*` variables or client-side code.
