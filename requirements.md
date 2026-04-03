# Task Time Tracker App  – Requirements Document

Tasko

## 1. Project Overview
A productivity app to track the time spent on various tasks, categorized by skill. The app will allow users to log tasks, assign them to skills, and analyze time spent per skill over different periods (day, week, year).

---

## 2. Core Features

### 2.1 Task Management
- Add, edit, and delete tasks.
- Each task has:
  - Name/description
  - Associated skill (e.g., Programming, Writing, Design)
  - Start and end time (or duration)
  - Date

### 2.2 Skill Management
- Add, edit, and delete skills.
- Assign skills to tasks.

### 2.3 Time Tracking
- Pomodoro Timer functionality to track time live. (important)
- Manual entry of time spent on tasks. (nice to have)

### 2.4 Analytics & Reporting
- View total time spent per skill:
  - Daily
  - Weekly
  - Yearly
- Visualizations (charts/graphs) for time distribution. (nice to have)

---

## 3. User Stories

- As a user, I want to log a task and assign it to a skill.
- As a user, I want to see how much time I spent on each skill today, this week, and this year.
- As a user, I want to add new skills as my interests grow.
- As a user, I want to edit or delete tasks and skills.
- As a user, I want to see visual summaries of my time allocation.

---

## 4. Technical Requirements

### 4.1 Platform
- Web app (React, Vue, or similar) or Desktop app (Electron, Tauri, etc.)
- Backend: Node.js/Express, Python (Flask/FastAPI), or local storage for MVP

### 4.2 Data Storage
- Local (SQLite, IndexedDB, or JSON file) for MVP
- (Optional) Cloud sync for future

### 4.3 UI/UX
- Simple, intuitive interface
- Responsive design

---

## 5. Stretch Goals

- Manual time entry for tasks (if not included in MVP)
- Advanced analytics and visualizations (charts, graphs, trends)
- Export data (CSV, JSON)
- Cloud sync and user authentication for multi-device support
- Mobile app (native or PWA enhancements)
- Reminders/notifications for Pomodoro sessions or task deadlines
- Customizable Pomodoro settings (session length, break intervals)
- Dark mode and additional UI themes
- LLM API integration for insights on user data
- Have a backlog of tasks and random picker option to decide what task to do next

---

## 6. Open Questions

- Do you want a web, desktop, or mobile app first?
    web app is preferred, and should be usable(responsive) on both desktop and mobile device
- Should the MVP include authentication?
    authentication is not required at MVP, and it is sufficient for all progress to be stored locally in browser
- Is live timer tracking required, or is manual entry enough?
    task tracking should be done via pomodoro format
- Any preferred tech stack?
    modern web development stack
