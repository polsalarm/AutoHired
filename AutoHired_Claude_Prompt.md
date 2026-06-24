# AutoHired - AI Application Tracker PWA
**Prompt for Claude**

*Copy the text below and paste it into Claude to kickstart the development of AutoHired.*

***

**Role:** You are an Expert Full-Stack Developer specializing in Progressive Web Apps (PWAs), TypeScript, and AI integration.

**Project Goal:** I want to build a Mobile PWA called **"AutoHired"** to track and manage my applications for internships, ambassadorships, and hackathons. The app needs to automate the organization process and use AI to evaluate my application readiness.

**Tech Stack Requirements:**
* **Frontend:** React, Vite, TypeScript, Tailwind CSS
* **Backend:** Node.js, Express, TypeScript
* **Database/Auth/Storage:** Supabase

**Core Features Required:**
1.  **Link Scraper & Application Parser:** I can paste a URL (e.g., a job posting or program link). The backend should scrape the page, extract the core requirements, role description, and deadlines.
2.  **Dynamic Checklist Generator:** Based on the scraped data, the app automatically generates a "To-Do" checklist (e.g., "Write cover letter focusing on React," "Get recommendation letter," "Submit by Friday").
3.  **Document Vault:** A secure storage area where I can upload and manage my documents (Resumes, CVs, portfolios, cover letters) using Supabase Storage.
4.  **AI Document Scanner & Matcher:** An AI feature that analyzes my stored resume/CV against the scraped requirements of a specific link. 
5.  **Feasibility Score & Actionable Suggestions:** The AI calculates a "Match Percentage" (e.g., 85% match) indicating how feasible it is for me to get the role. It must also generate actionable suggestions on what to adjust in my resume or skills to increase my chances.

**What I need from you:**
1.  **Project Architecture & Flow:** Briefly explain how these components will communicate, especially the link scraping and AI analysis pipeline. Define the core TypeScript interfaces for the scraped data and AI response.
2.  **Database Schema:** Provide the Supabase SQL schema for Users, Applications (the scraped jobs), Documents, and Tasks (the checklists).
3.  **Recommended APIs:** Suggest the best tools/APIs to use for the web scraping (e.g., Puppeteer, Cheerio) and the AI parsing (e.g., OpenAI API).
4.  **Boilerplate Code:** Provide the foundational code for:
    * The frontend PWA setup (manifest/service worker approach) using TS for AutoHired.
    * The backend Express route (in TS) that handles receiving a URL, scraping it, and prompting the AI.

Please write clean, modular, strongly typed, and well-commented code, keeping mobile responsiveness top of mind with Tailwind CSS.
