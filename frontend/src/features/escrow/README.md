# escrow (frontend)

**Owner:** Tamal Deb Nath `[TDN]` — nobody else commits in this folder.
Backend counterpart: `backend/modules/escrow/`

```
components/   your React components
hooks/        your custom hooks
api/          thin wrappers over @/lib/api for this feature's endpoints
```

## Rules
- Import `api` from `@/lib/api`, never create another axios instance.
- Use design tokens only (`bg-surface`, `text-ink`, `bg-brand-primary`).
  No raw hex, no `bg-[#...]`, no `bg-emerald-500`, no `dark:` variants.
- Render booking state with the shared `<StatusBadge />`, money with `<Money />`.
