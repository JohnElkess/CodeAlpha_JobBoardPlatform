# CodeAlpha_JobBoardPlatform
# Job Board Platform API

A backend for a LinkedIn-style job board, built with Node.js, Express and MongoDB. Employers post jobs, candidates search and apply with a resume, and employers move applications through a review pipeline. Candidates and employers get email notifications along the way.

Built for CodeAlpha, Task 4 (Job Board Platform).

## Features

- Registration and login with JWT, two roles: `CANDIDATE` and `EMPLOYER`
- Employers: create, edit, close/reopen and delete jobs; see applicants per job; dashboard with application counts per status; update application status
- Candidates: search jobs (keyword, location, type, pagination), apply with a resume upload, track applications with a status timeline, withdraw an application
- Resume uploads stored locally, downloadable only by the applicant and the job's owner
- Email notifications: employer is notified of a new application, candidate is notified of a status change
- Interactive API documentation (Swagger UI)
- 53 automated tests and a CI pipeline

## Tech stack

| Area | Choice |
|---|---|
| Runtime / framework | Node.js 22, Express 5 |
| Database | MongoDB 7 via Mongoose |
| Auth | JWT, bcrypt password hashing |
| Uploads | multer (local disk) |
| Email | nodemailer (any SMTP provider) |
| Security | helmet, express-rate-limit, CORS allowlist |
| Docs | OpenAPI 3 + swagger-ui-express |
| Tests | Jest, supertest, mongodb-memory-server |
| Delivery | Docker (multi-stage), Docker Compose, GitHub Actions |

## Quick start

### Option 1: everything in Docker

```bash
cp .env.example .env        # Windows cmd: copy .env.example .env
# edit .env: set JWT_SECRET (and SMTP settings if you want real emails)
docker compose up --build
```

The API is at <http://localhost:3000> and the docs at <http://localhost:3000/api-docs>.

Inside Compose the API reaches MongoDB at `mongodb://mongo:27017/jobboard`. Compose sets this itself, overriding `MONGO_URI` from `.env`.

Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Option 2: run the API locally, MongoDB in Docker

```bash
docker compose up -d mongo
npm install
npm run dev                 # nodemon, restarts on changes
```

### Without SMTP credentials

If `SMTP_HOST` is empty, emails are printed to the console instead of being sent, so the project runs without any mail account. For safe testing with real SMTP behavior, an [Ethereal](https://ethereal.email) fake inbox works with the same settings.

## Configuration

All settings are environment variables (see `.env.example`).

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign tokens. Keep it private |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP server and credentials |
| `MAIL_FROM` | Sender shown on emails |
| `CORS_ORIGIN` | Comma-separated browser origins allowed to call the API. Empty means none |

## API overview

Full details, schemas and a "Try it out" button are in Swagger UI at `/api-docs`. The raw spec is at `/api-docs.json` and can be imported into Postman.

Protected endpoints expect `Authorization: Bearer <token>`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a candidate or employer |
| POST | `/api/auth/login` | Public | Log in, receive a JWT |
| GET | `/api/jobs` | Public | Search open jobs. Query: `q`, `location`, `jobType`, `page`, `limit` |
| GET | `/api/jobs/:id` | Public | Job details |
| POST | `/api/jobs` | Employer | Create a job |
| GET | `/api/jobs/mine` | Employer | Own jobs with application counts per status |
| PATCH | `/api/jobs/:id` | Owner | Edit a job, or set `status` to `OPEN` / `CLOSED` |
| DELETE | `/api/jobs/:id` | Owner | Delete a job (409 if it has applications; close it instead) |
| POST | `/api/jobs/:id/apply` | Candidate | Apply with a resume (`multipart/form-data`, field `resume`) |
| GET | `/api/jobs/:id/applications` | Owner | Applicants for a job |
| GET | `/api/applications/my` | Candidate | Own applications and their status history |
| PATCH | `/api/applications/:id/status` | Owner | Set `IN_REVIEW`, `ACCEPTED` or `REJECTED` |
| PATCH | `/api/applications/:id/withdraw` | Candidate | Withdraw own application |
| GET | `/api/applications/:id/resume` | Applicant or owner | Download the resume |

"Owner" means the employer who created the job. Errors are returned as `{ "message": "..." }` with a meaningful status code (400 validation, 401 not authenticated, 403 wrong role or not the owner, 404, 409 conflict, 429 rate limited).

### Data model

- **User**: `email`, `password` (bcrypt hash, never returned), `role`, `profile` (name, phone, company info)
- **Job**: `employer` (ref User), `title`, `description`, `location`, `jobType`, `salaryRange`, `status` (`OPEN` / `CLOSED`)
- **Application**: `job`, `candidate`, `resumePath`, `status` (`APPLIED`, `IN_REVIEW`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`), `statusHistory`. A unique index on `(job, candidate)` allows one application per candidate per job.

## Architecture

### Layers

```
src/
  routes/        URL -> middleware chain -> controller
  controllers/   read the request, call a service, send the response
  services/      business logic and ownership rules (no req/res)
  models/        Mongoose schemas
  middlewares/   auth, validation, upload, rate limits, error handling
  events/        event emitter and listeners
  factories/     email template factory
  config/        database connection
  docs/          OpenAPI spec
  utils/         AppError, asyncHandler
```

Dependencies only point downward: routes know controllers, controllers know services, services know models. `req` and `res` never reach a service, which keeps the business rules easy to test.

### Design patterns

- **Chain of Responsibility**: a route is a pipeline of middleware, and each link either rejects the request or passes it on.
  `authenticate (JWT) -> authorize (role) -> multer (file) -> validation -> controller`
- **Observer**: services emit events (`application:created`, `application:statusChanged`) through a Node `EventEmitter` and know nothing about email. Listeners react independently, so the HTTP response never waits for mail and a mail failure cannot fail a request.
- **Factory**: `createEmail(type, data)` builds the subject, text and HTML for each notification type. Adding a notification means adding one template.

### Security measures

- Passwords hashed with bcrypt; password hash excluded from queries by default
- Login errors are identical for unknown email and wrong password
- Role checks plus ownership checks on every employer action (a second employer gets 403 on someone else's job)
- The employer and candidate ids come from the token, never from the request body; only whitelisted fields are accepted
- `helmet` security headers, CORS allowlist, rate limits (300 requests per 15 minutes on `/api`; 10 failed login or register attempts per 15 minutes per IP and email)
- Query inputs are cast to strings and regexes are escaped, which blocks NoSQL operator injection
- Uploads: allowlisted types (PDF, DOC, DOCX), 5 MB limit, server-generated file names, files removed when an application fails, downloads only through an authorized endpoint (no public static folder)
- User-provided text is HTML-escaped in emails
- The container runs as a non-root user

## Testing

```bash
npm test
```

53 tests across authentication, jobs and applications. They run against an in-memory MongoDB, so no Docker or database is needed, and no email is sent. They cover role and ownership rules, validation, duplicate handling, orphaned-file cleanup, status history, the dashboard counts and the emitted events.

GitHub Actions runs the tests on every push and pull request, then builds the Docker image, starts the full Compose stack and checks `/health`.

## Design decisions and limitations

- **Withdrawing keeps the record.** It sets status `WITHDRAWN` and the employer still sees it. Because of the unique `(job, candidate)` index, a candidate cannot re-apply after withdrawing.
- **Jobs with applications cannot be deleted.** Close them instead, so hiring history is preserved.
- **Events are in-process.** An event is lost if the server crashes at the wrong moment, and failed emails are logged, not retried. With several instances, each handles its own events. A durable queue (BullMQ, RabbitMQ) would be the production choice.
- **Rate-limit counters are in memory**, so they reset on restart and are per instance. A shared store such as Redis would fix that. Behind a reverse proxy, `trust proxy` must be configured for client IPs to be correct.
- **The resume check trusts the client-reported file type.** A production system would also inspect file contents and scan for malware.
- **Resumes live on local disk.** That works for a single instance; multiple instances need shared or object storage such as S3.
- **Keyword search matches whole words** (MongoDB text index with stemming), not substrings.
- **The OpenAPI spec is hand-written** and must be updated when endpoints change. The `/api-docs` page is public by design here.
- **Not included:** refresh tokens, email verification, password reset.