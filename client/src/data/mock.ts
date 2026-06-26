import type {
  Application,
  TaskItem,
  VaultDocument,
  AIAnalysis,
  ProfileStats,
  ScheduleEvent,
} from "../types";

const inDays = (d: number, h = 10): string => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(h, 0, 0, 0);
  return date.toISOString();
};

/**
 * Phase 0 mock data mirroring the Stitch design screens.
 * Replaced by Supabase queries in Phase 1+.
 */

export const mockApplications: Application[] = [
  {
    id: "app-1",
    userId: "user-1",
    url: "https://careers.google.com/jobs/swe-intern",
    title: "Software Engineer Intern",
    company: "Google",
    location: "Mountain View, CA",
    description:
      "Join our dynamic team to build the next generation of web applications. You will be working closely with senior engineers to design, develop, test, and deploy scalable software solutions.\n\nResponsibilities include participating in code reviews, writing automated tests, and collaborating with cross-functional teams to define product requirements.",
    requirements: [
      "Currently pursuing a BS/MS in Computer Science or related field.",
      "Strong proficiency in JavaScript, HTML, and CSS.",
      "Experience with modern frameworks like React or Angular.",
      "Familiarity with backend languages (e.g., Python, Java, or Node.js).",
      "Excellent problem-solving skills and attention to detail.",
    ],
    deadline: "2026-06-13",
    status: "applied",
    matchScore: 92,
    createdAt: "2026-06-01T10:00:00Z",
  },
  {
    id: "app-2",
    userId: "user-1",
    url: "https://vercel.com/careers/frontend-developer",
    title: "Frontend Developer",
    company: "Vercel",
    location: "Remote",
    description:
      "Build delightful, fast web experiences on the Vercel platform with React and Next.js.",
    requirements: [
      "Deep React and TypeScript experience.",
      "Familiarity with Next.js and edge runtimes.",
      "Strong CSS and design-system sensibilities.",
    ],
    deadline: "2026-06-21",
    status: "interviewing",
    matchScore: 88,
    createdAt: "2026-05-28T09:00:00Z",
  },
  {
    id: "app-3",
    userId: "user-1",
    url: "https://figma.com/careers/product-design-intern",
    title: "Product Design Intern",
    company: "Figma",
    location: "San Francisco, CA",
    description:
      "Work alongside our design team to craft tools used by millions of designers.",
    requirements: [
      "Portfolio demonstrating product thinking.",
      "Proficiency with Figma.",
      "Understanding of interaction design fundamentals.",
    ],
    deadline: "2026-06-16",
    status: "draft",
    matchScore: 75,
    createdAt: "2026-06-05T14:30:00Z",
  },
];

export const mockTasks: TaskItem[] = [
  {
    id: "task-1",
    applicationId: "app-1",
    label: "Complete online assessment",
    dueDate: "2026-06-11",
    done: false,
    source: "ai",
  },
  {
    id: "task-2",
    applicationId: "app-2",
    label: "Write cover letter",
    dueDate: "2026-06-15",
    done: true,
    source: "ai",
  },
  {
    id: "task-3",
    applicationId: "app-3",
    label: "Refine case study",
    dueDate: "2026-06-14",
    done: false,
    source: "ai",
  },
];

export const mockDocuments: VaultDocument[] = [
  {
    id: "doc-1",
    userId: "user-1",
    name: "Resume_2024_Main.pdf",
    type: "resume",
    storagePath: "user-1/Resume_2024_Main.pdf",
    parsedText: [
      "Alex Rivera",
      "alex.rivera@email.com | (555) 010-2244 | San Francisco, CA | https://github.com/alexrivera",
      "",
      "Frontend engineer with 6 years building accessible, high-traffic web apps.",
      "",
      "EXPERIENCE",
      "Senior Frontend Engineer, Brightlane (2021–Present)",
      "- Led migration of a 200k-line app from JavaScript to TypeScript, cutting runtime type errors by 40%.",
      "- Built a reusable component library adopted by 5 product teams.",
      "- Mentored 4 junior engineers through code review and pairing.",
      "Frontend Developer, Nimbus Labs (2018–2021)",
      "- Shipped a React dashboard used daily by 12,000 users.",
      "- Improved Lighthouse performance score from 62 to 94.",
      "",
      "SKILLS",
      "React, TypeScript, Node.js, GraphQL, Jest, Accessibility (WCAG)",
      "",
      "EDUCATION",
      "B.S. Computer Science, UC Berkeley, 2018",
    ].join("\n"),
    status: "analyzed",
    addedAt: "2026-06-09T08:00:00Z",
  },
  {
    id: "doc-2",
    userId: "user-1",
    name: "Portfolio_Link",
    type: "portfolio",
    storagePath: "user-1/portfolio.url",
    parsedText: null,
    status: "pending",
    addedAt: "2026-06-04T08:00:00Z",
  },
  {
    id: "doc-3",
    userId: "user-1",
    name: "Cover_Letter_V1.pdf",
    type: "cover_letter",
    storagePath: "user-1/Cover_Letter_V1.pdf",
    parsedText: null,
    status: "pending",
    addedAt: "2026-05-28T08:00:00Z",
  },
];

export const mockAnalysis: AIAnalysis = {
  id: "analysis-1",
  applicationId: "app-1",
  documentId: "doc-1",
  matchScore: 92,
  verdict: "Excellent Match",
  summary:
    "Strong candidate based on your profile, but lacks direct Python experience mentioned in requirements.",
  suggestions: [
    "Highlight your React projects, particularly the dashboard application.",
    "Add Python to your skills section if you have basic familiarity.",
    "Mention your 1st place hackathon experience prominently.",
  ],
  gaps: ["Python"],
  strengths: ["React", "JavaScript", "Hackathon experience"],
  createdAt: "2026-06-09T12:00:00Z",
};

export const mockEvents: ScheduleEvent[] = [
  {
    id: "event-1",
    userId: "user-1",
    applicationId: "app-2",
    type: "interview",
    title: "Vercel — Technical Interview",
    startsAt: inDays(2, 14),
    location: "Google Meet",
    notes: "Round 2 · live coding (React + TS). Review hooks + Next.js routing.",
    done: false,
    createdAt: inDays(-1),
  },
  {
    id: "event-2",
    userId: "user-1",
    applicationId: "app-1",
    type: "call",
    title: "Google — Recruiter Call",
    startsAt: inDays(5, 11),
    location: "Phone",
    notes: "Intro call with recruiter about the SWE internship.",
    done: false,
    createdAt: inDays(-1),
  },
  {
    id: "event-3",
    userId: "user-1",
    applicationId: "app-3",
    type: "deadline",
    title: "Figma — Application Deadline",
    startsAt: inDays(-1, 23),
    location: null,
    notes: "Portfolio submission due.",
    done: true,
    createdAt: inDays(-3),
  },
];

export const mockStats: ProfileStats = {
  applicationsSent: 142,
  interviewsSecured: 12,
  avgMatchScore: 85,
};

export const mockUser = {
  name: "Alex Johnson",
  headline: "Aspiring Software Engineer",
};
