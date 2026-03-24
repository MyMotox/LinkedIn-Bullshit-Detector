# LinkedIn Bullshit Detector

This Firefox extension reads a LinkedIn profile and scores how buzzword-heavy it is. It looks at headline, about section, experience, education, skills, and visible posts, then returns a detailed breakdown.

The extension does not call OpenAI directly. It sends profile text to a backend endpoint, and the backend calls OpenAI using a server-side key.

## How it works

1. The extension scrapes profile content from LinkedIn.
2. It sends cleaned profile text to an API endpoint.
3. The backend calls OpenAI and returns structured JSON.
4. The popup renders the score, categories, and quotes.

## Security model

- `OPENAI_API_KEY` stays on the server.
- No API key is stored in extension code.
- Secret files are ignored by Git.

You will see both `server/.env.example` and `server/.env`:

- `server/.env.example` is a template committed to Git.
- `server/.env` contains real secrets and must stay private.

## Daily limits

- Default: 10 analyses per day per client.
- Elevated: 50 analyses per day with admin password.
- Password check happens on the backend only (`ADMIN_LIMIT_PASSWORD`).

## Run locally

1. Open a terminal in [server](server).
2. Install dependencies:

```bash
npm install
```

3. Create a local env file from the template.
4. Set at least:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=8787
ADMIN_LIMIT_PASSWORD=motherlord
```

5. Start the local API:

```bash
npm start
```

Local endpoints:

- `http://localhost:8787/health`
- `http://localhost:8787/v1/analyze`

## Deploy on Vercel

Serverless handlers are in [api/analyze.js](api/analyze.js) and [api/health.js](api/health.js).

In Vercel project environment variables, set:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional)
- `ADMIN_LIMIT_PASSWORD`

After deploy, use:

- `https://your-project.vercel.app/api/health`
- `https://your-project.vercel.app/api/analyze`

Then set your production API URL in [popup.js](popup.js).

## Load extension in Firefox

1. Go to `about:debugging`.
2. Open **This Firefox**.
3. Click **Load Temporary Add-on**.
4. Select [manifest.json](manifest.json).

## Notes

- The quality of results depends on what LinkedIn content is visible on the page.
- The scraper filters common LinkedIn UI/system text before analysis.
