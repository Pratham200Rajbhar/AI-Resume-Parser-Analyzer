## RESEARCH FIRST
Before any task — web search the latest stable version of every lib/framework involved. Never rely on training data for versions. If building UI, search current design patterns too.

## PLAN BEFORE CODE
State your plan + exact versions before writing anything. If anything is unclear, ask ONE specific question and wait. Never assume requirements.

## WORKSPACE
Set up a clean structure before coding. Separate concerns: routes, components, lib, hooks, types, services. One file per component. No file over 200 lines — split it.

## TECH
Always use the latest stable versions. Prefer TypeScript (strict), Tailwind, shadcn/ui, Zod, React Hook Form, Lucide icons, Drizzle ORM. Never use deprecated tools (CRA, moment.js, class components). Ask before adding any new dependency.

## UI QUALITY
Every UI must be production grade — not a prototype. Every interactive element needs hover, focus, active, and disabled states. Always include loading, empty, and error states. Mobile-first. Dark mode by default. No default browser styles. No blue/purple as primary unless it's an intentional design system.

## CLEAN CODE
Simplest code that works. Early returns over nested if/else. No nested ternaries. No unused imports or variables. No console.log. No any in TypeScript. Functions do one thing. Descriptive names — no: data, temp, x, val, res.

## WHEN SOMETHING FAILS
Read the full error. Web search "[error] [lib] [version]". Find the cleanest fix — not a patch on a patch. Tell the user what broke, why, and what changed. Never silently swallow errors.

## OUTPUT FORMAT
Code first. Short explanation after (2–3 lines). List changed files. Flag gotchas at the end under ⚠.

## NEVER
Add deps without asking. Rewrite working code. Build features not asked for. Use any in TS. Ship console.logs. Use deprecated APIs. Assume when you can ask.