# 18Roots platform

| Folder | What it is |
| --- | --- |
| `meeting-service/` | Phase 1: one-to-one video consultations (Rails, LiveKit) |
| `main-backend/` | Phase 2a: sign-in, doctors, booking, payments, care plans, orders (Rails) |
| `18roots_app/` | Phase 2c: the patient app for Android and iOS (Expo, React Native) |
| `render.yaml` | Render Blueprint for both backends |
| `render-deploy/` | Deployment guide and helper scripts |

To put it online, follow `render-deploy/DEPLOY-GITHUB.md`, which uses this repository and `render.yaml`. `render-deploy/DEPLOY.md` is the other way, through Docker Hub with no GitHub. For the plan, see `meeting-service/docs/ROADMAP.md`.
