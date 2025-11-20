# iTrack — Digitalized Inventory Management and Analytics System

iTrack is a web-based inventory management and analytics system developed as a capstone project for the USTP Display Center. It digitizes inventory tracking, sales reporting, and predictive restocking using machine learning.

The system is split into:

- **Backend** — FastAPI + MySQL (deployed on Render)
- **Frontend** — React.js (deployed on Vercel)

---

## 🚀 Features

- 📦 **Inventory Management**
  - Item list with stock levels
  - Stock-in / stock-out tracking
  - Stock card view per item

- 🧾 **Sales & Reports**
  - Daily / monthly sales reports
  - Exportable summaries
  - Custom order slips / job order slips (PDF)

- 📊 **Dashboard & Analytics**
  - KPIs (total items, sales, low stock, etc.)
  - Charts for sales and inventory trends

- 🤖 **Predictive Restocking**
  - Uses historical sales to forecast demand
  - Reorder recommendations per item
  - Monthly restock plan export

- 🔐 **User Roles & Activity Logs**
  - Role-based access (Admin, Staff, Enterprise)
  - Activity logs for auditing user actions

---

## 🏗️ Tech Stack

**Frontend**
- React.js
- React Router
- Recharts (charts)
- jsPDF + jsPDF-Autotable (PDF generation)
- Axios (API calls)

**Backend**
- Python
- FastAPI
- MySQL (via mysql-connector)
- Pandas, NumPy
- Prophet / scikit-learn (forecasting)
- JWT (authentication)

**Infrastructure**
- Render (FastAPI backend)
- Vercel (React frontend)
- GitHub (version control & CI trigger)

---

## 📂 Project Structure

```bash
capstone_itrack/
├── backend/
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── security/
│   ├── db.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js / other config
├── .gitignore
├── package.json        # root (if using)
└── README.md
