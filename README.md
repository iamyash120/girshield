# 🦁 GirShield AI
### AI-Based Gir Forest Human-Wildlife Conflict Mitigation System

> An Agentic AI-powered platform that predicts wildlife movement, issues real-time alerts, and coordinates rapid response between forest officials and local communities to reduce human-wildlife conflict around Gir Forest.

---

## 📌 Overview

GirShield AI is an intelligent environmental sustainability platform developed for the **IBM TechXchange Hackathon – Challenge 4**. The platform leverages **IBM Granite LLM**, **IBM Agentic AI (BeeAI/Bob)**, and **IBM Cloud** to proactively predict wildlife movement, notify nearby villages, coordinate forest rescue teams, and streamline livestock compensation workflows.

The system aims to minimize conflicts between humans and wildlife by combining predictive AI, geospatial visualization, real-time notifications, and multi-agent collaboration into a single intelligent ecosystem.

---

# Problem Statement

Communities surrounding Gir Forest frequently experience human-wildlife conflicts due to Asiatic lions and leopards entering nearby villages. Delayed alerts, limited coordination, and inefficient response mechanisms often result in livestock loss, human injuries, and retaliatory harm to wildlife.

GirShield AI addresses these challenges through predictive intelligence, real-time communication, and AI-assisted decision-making.

---

# Objectives

- Predict wildlife movement near villages
- Generate early warning alerts
- Coordinate rapid response among forest officers
- Reduce livestock losses
- Assist villagers with compensation claims
- Identify conflict hotspots
- Provide AI-driven recommendations
- Improve wildlife conservation and public safety

---

# Key Features

## Wildlife Movement Prediction

- AI-powered movement prediction
- Threat probability analysis
- Route forecasting
- Risk assessment
- Confidence score generation

---

## Real-Time Village Alerts

- Push notifications
- SMS-ready alerts
- Emergency notifications
- Safety recommendations
- Localized warning system

---

## Forest Officer Dashboard

- Active incident monitoring
- Rescue mission management
- Wildlife tracking
- Mission timeline
- Resource allocation
- Live incident updates

---

## Villager Dashboard

- Nearby wildlife alerts
- Emergency SOS
- Livestock management
- Compensation tracking
- Safe zone information
- AI safety assistant

---

## Admin Dashboard

- User management
- Village management
- Wildlife database
- Analytics dashboard
- AI monitoring
- System configuration

---

## Interactive GIS Map

- Gir Forest visualization
- Village mapping
- Wildlife sightings
- Predicted movement paths
- Heatmaps
- Rescue locations
- Protected areas

---

## AI Chat Assistant

Powered by IBM Granite LLM.

Capabilities include:

- Safety guidance
- Wildlife information
- Report generation
- Incident summaries
- Natural language queries
- Officer assistance

---

## Livestock Compensation Assistant

- Claim guidance
- Document verification
- Status tracking
- Compensation estimation
- Application generation

---

## Conflict Analytics

- Hotspot analysis
- Monthly reports
- Wildlife trends
- Incident statistics
- Response time analysis
- Prediction accuracy

---

# AI Agents

GirShield AI follows a multi-agent architecture.

## Wildlife Movement Prediction Agent

Responsible for predicting wildlife movement using historical sightings, GPS data, weather conditions, seasonal patterns, and environmental factors.

---

## Village Alert Agent

Generates real-time alerts for nearby villages and recommends immediate safety measures.

---

## Forest Response Coordination Agent

Assigns the nearest forest officer, creates rescue missions, monitors progress, and tracks completion.

---

## Livestock Compensation Agent

Guides villagers through compensation claims while validating submitted information and estimating compensation.

---

## Conflict Hotspot Analytics Agent

Analyzes incident history to identify high-risk zones, generate reports, and provide strategic recommendations.

---

# Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- ShadCN UI
- Framer Motion
- React Query
- React Hook Form
- Zod
- Leaflet / Mapbox
- Chart.js
- Lucide Icons

---

## Backend

- Node.js
- Express.js
- TypeScript
- REST API
- JWT Authentication
- WebSockets
- Swagger Documentation

---

## Database

- PostgreSQL

---

## Artificial Intelligence

- IBM Granite LLM
- IBM BeeAI / Bob Agentic AI
- Predictive AI Models

---

## Cloud

- IBM Cloud
- IBM Cloud Object Storage
- IBM Secrets Manager
- IBM Code Engine

---

## Development Tools

- Git
- GitHub
- Docker
- Docker Compose
- Postman
- VS Code

---

# System Architecture

```
Villager
      │
      ▼
Frontend (Next.js)
      │
      ▼
Backend API (Express.js)
      │
      ├──────── PostgreSQL
      │
      ├──────── IBM Granite LLM
      │
      ├──────── Agentic AI Workflow
      │
      ├──────── Notification Engine
      │
      ▼
Forest Officer Dashboard
```

---

# Project Structure

```
girshield-ai/

│
├── frontend/
│
├── backend/
│
├── database/
│
├── ai-agents/
│
├── docs/
│
├── docker/
│
├── assets/
│
├── README.md
│
└── docker-compose.yml
```

---

# Authentication

- JWT Authentication
- Refresh Tokens
- Email Verification
- OTP Verification
- Role-Based Access Control
- Session Management

---

# User Roles

## Villager

- View alerts
- Report wildlife sightings
- Track compensation
- Request emergency help
- View safe zones

---

## Forest Officer

- View incidents
- Manage rescue operations
- Track wildlife
- Coordinate field teams
- Update mission status

---

## Administrator

- Manage users
- Manage villages
- Manage wildlife database
- Monitor AI agents
- Generate reports
- Configure system

---

# API Modules

- Authentication
- Users
- Villages
- Wildlife
- GPS Tracking
- AI Predictions
- Alerts
- Rescue Operations
- Compensation
- Reports
- Dashboard
- Analytics
- Notifications
- AI Assistant

---

# Security Features

- JWT Authentication
- Password Hashing
- Helmet Security
- CORS Protection
- SQL Injection Prevention
- XSS Protection
- Rate Limiting
- Input Validation
- Environment Variables
- Audit Logging

---

# Performance Optimizations

- Lazy Loading
- Code Splitting
- API Caching
- Database Indexing
- Optimized Queries
- Pagination
- Skeleton Loading
- Image Optimization

---

# Future Enhancements

- IoT Camera Integration
- Drone Surveillance
- Satellite Data Integration
- GPS Collar Tracking
- Offline Mobile Support
- Voice-Based Emergency Alerts
- Multilingual Support
- WhatsApp Alert Integration
- AI-Based Wildlife Behavior Analysis
- Predictive Seasonal Migration Models

---

# Expected Impact

- Reduce human-wildlife conflicts
- Improve villager safety
- Protect endangered wildlife
- Accelerate rescue operations
- Enable data-driven conservation
- Improve coordination among stakeholders
- Enhance environmental sustainability

---

# Installation

## Clone Repository

```bash
git clone https://github.com/your-username/girshield-ai.git
```

---

## Navigate

```bash
cd girshield-ai
```

---

## Install Frontend

```bash
cd frontend
npm install
```

---

## Install Backend

```bash
cd backend
npm install
```

---

## Configure Environment Variables

Create `.env` files in both frontend and backend directories.

---

## Start Development

Frontend

```bash
npm run dev
```

Backend

```bash
npm run dev
```

---

# Contributing

Contributions are welcome.

Please fork the repository, create a feature branch, commit your changes, and submit a pull request for review.

---

# License

This project is developed for educational and hackathon purposes.

---

# Acknowledgements

- IBM TechXchange Hackathon
- IBM Granite LLM
- IBM Agentic AI (BeeAI/Bob)
- IBM Cloud
- Gir Forest Ecosystem
- Forest Department of Gujarat

---

## Built with ❤️ for Wildlife Conservation, Community Safety, and Environmental Sustainability.
