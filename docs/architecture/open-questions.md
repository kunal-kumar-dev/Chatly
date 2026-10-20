# Open Questions Before Implementation

Before starting Phase 1 implementation, I need clarification on the following:

## Authentication & Security
1. **Password requirements**: Any specific password complexity rules (min length, special chars)?
2. **JWT configuration**: Access token expiry (suggest 15min) and refresh token expiry (suggest 7-30 days)? Any rotation policy details?
3. **Rate limiting**: Specific limits for login attempts, API calls?
4. **SSO preparation**: Any specific OIDC providers to prioritize for later (Google/Microsoft mentioned)?

## File Storage & Security
5. **File size limits**: Default max file size? (Suggested 50MB in schema)
6. **Allowed file types**: Specific allowlist beyond images/PDF/docs/ZIP? (Schema has JSONB)
7. **Virus scanning**: Should ClamAV be included in docker-compose for dev, or just the hook?
8. **S3/MinIO**: Any specific bucket structure or naming conventions?

## Messaging & Features
9. **Message length**: Max message content length?
10. **Group read receipts**: Default for `show_read_receipts` setting?
11. **Delete message permissions**: Exact rules - can users delete others' messages in channels they own? (Schema has delete_own/delete_any)
12. **Threading**: Max thread depth? Or just one level?
13. **Reactions**: Limit number of reactions per message?

## Admin & Moderation
14. **Super Admin creation**: How is first Super Admin created? Seed script?
15. **Audit log retention**: Any specific requirements?
16. **Data export**: Format for exports (JSON/CSV)?

## UI/UX
17. **Branding assets**: Do you have specific logo designs/colors, or should I create simple ones?
18. **Default theme**: Light/dark both supported (yes per requirements)
19. **Mobile responsiveness**: Any specific breakpoints beyond standard Tailwind?

## Technical Decisions
20. **ORM choice**: Prisma or TypeORM? (Schema supports both; I need to pick one)
21. **State management**: Zustand or Redux Toolkit for frontend?
22. **UI components**: Build from scratch or use component library (shadcn/ui recommended)?
23. **Testing framework**: Jest for both backend/frontend? (NestJS default is Jest)
24. **Monorepo**: Use npm workspaces, pnpm workspaces, or separate repos?

## Deployment
25. **Environment**: Target deployment platform? (affects docker-compose setup)

---

**My recommendations based on the requirements:**
- **ORM**: Prisma (great DX, migrations, type safety)
- **Frontend state**: Zustand (simple, less boilerplate)
- **UI components**: shadcn/ui (Tailwind-based, customizable)
- **Monorepo**: npm workspaces for simplicity
- **First Super Admin**: Created via seed script
- **Password hashing**: argon2 (more secure than bcrypt)
- **Default tokens**: Access 15min, Refresh 7 days with rotation

Please answer these questions or confirm the recommendations, and I'll proceed to Phase 1 implementation.
