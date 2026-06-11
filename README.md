# Welcome to Tasko - the smart task tracking partner

The purpose of TASKO is to help you see where your time is going. It makes tracking your todo list and skill development easy - so that you WANT to be productive.

Its really driven by the fact that I really wish that something this intuitive was on the market ... I can't count the number of times that I've started a new notebook or journal or to-do list app with the intention of becoming a totally productive super machine and knocking off everything on my backlog! Sadly I've never found any of those methods to stick - I am only 110% sure its not a issue on my part ! LOL.

## Features as of now:
 - create new tasks and complete pomodoro sessions towards those tasks
 - assign tasks to skills, so all pomodoro session times go towards skills
 - get a deep dive into your stats and analytics ! 

## To be added:
 - cloud storage
    - core tables 
        - skills: id, name, minutes_spent, created_at, updated_at
        - tasks: id, name, skill_id, status, completed_pomodoros, minutes_spent, created_at, updated_at
        - pomodoro_logs: id, task_id, skill_id, duration_minutes, completed_at, type ('timer'|'manual')
 - better UI
 - release as mobile app with mobile features : offline, swipe features, notifications, widgets

 ### Technical Details

- apps/backend/types.ts — TypeScript interfaces for Task, Skill, PomodoroLog
- apps/backend/api.ts — Express router with all API endpoints
- backend/index.ts — mount API routes and initialize DB (updated)