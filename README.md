# ⚙️ Visitor — Backend Service

[![GitHub stars](https://img.shields.io/github/stars/sokratgruzit/visitor-backend?style=social)](https://github.com/sokratgruzit/visitor-backend/stargazers)  
[![GitHub forks](https://img.shields.io/github/forks/sokratgruzit/visitor-backend?style=social)](https://github.com/sokratgruzit/visitor-backend/network/members)  
[![GitHub issues](https://img.shields.io/github/issues/sokratgruzit/visitor-backend)](https://github.com/sokratgruzit/visitor-backend/issues)  
[![License](https://img.shields.io/github/license/sokratgruzit/visitor-backend)](./LICENSE)

🚀 **Visitor Backend** is the core service powering the website builder platform.  
It handles authentication, API endpoints, data persistence, file storage, and integrations with external services.  
Built with **Node.js, Express, and PostgreSQL**, it ensures scalability, security, and smooth communication with the frontend.

---

## ✨ Features

- 🔑 **Authentication & Authorization** (JWT + HttpOnly Cookies)
- 🗄 **Database management** with Prisma ORM & PostgreSQL
- ☁️ **Supabase integration** for storage and database
- 💳 **Payments integration** (Yookassa API, Tinkoff)
- 🛠 **Microservices-ready architecture** with REST API endpoints
- 📂 File storage & retrieval system
- 🌍 Secure API for frontend apps & external services

---

## 🛠 Tech Stack

- **Core:** Node.js, Express
- **Database:** PostgreSQL + Prisma ORM
- **Storage:** Supabase Storage
- **Auth:** JWT, HttpOnly Cookies
- **Payments:** Yookassa API, Tinkoff API
- **Other:** Docker, ESLint, Prettier

---

## 🌐 Live Demo

Try the **Visitor Platform** in action:

[🚀 Visit Demo](https://visitor-ten.vercel.app/register)

> Note: This is the public demo link for testing registration, authentication, and landing page features.

## 🔌 API Endpoints

<details>
  <summary>Auth</summary>

- `POST /api/auth/register` → Register a new user
- `POST /api/auth/login` → Login and get tokens
- `POST /api/auth/refresh` → Refresh access token
- `POST /api/auth/logout` → Logout and clear session
</details>

<details>
  <summary>Payments</summary>

- `POST /api/payment/yookassa` → Create payment session
- `GET /api/payment/yookassa/status` → Get payment status
- `POST /api/payment/yookassa/cancel` → Cancel subscription
</details>

<details>
  <summary>Constructor</summary>

- `GET /api/constructor/landing/:slug` → Get public landing page by ID
- `POST /api/constructor/save-landing` → Save landing configuration
</details>

<details>
  <summary>Votings</summary>

- `GET /api/votings` → List all votings
- `POST /api/votings` → Create a new voting
- `PATC /api/votings/:id` → Update vote
</details>

<details>
  <summary>Animations</summary>

- `GET /api/animations` → Get all animations for user
- `POST /api/animations` → Create new animation
- `POST /api/animations` → Create new animation
- `GET /api/animations/:id` → Get animation by ID
</details>

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/sokratgruzit/visitor-backend.git

# Install dependencies
cd visitor-backend
npm install

# Run development server
npm run dev
```

## 📬 Contact

👨‍💻 Author: Tavadze David

📧 Email: tavadzed@gmail.com

💬 Telegram: [@black_sokrat](https://t.me/black_sokrat)

🌍 LinkedIn: [linkedin.com/in/david-tavadze-19361753/](https://www.linkedin.com/in/david-tavadze-19361753)
