# LinkedIn Bullshit Detector

This Firefox extension reads a LinkedIn profile and scores how buzzword-heavy it is. It looks at headline, about section, experience, education, skills, and visible posts, then returns a detailed breakdown.

The extension does not call OpenAI directly. It sends profile text to a backend endpoint, and the backend calls OpenAI using a server-side key.

## How it works

1. The extension scrapes profile content from LinkedIn.
2. It sends cleaned profile text to an API endpoint.
3. The backend calls OpenAI and returns structured JSON.
4. The popup renders the score, categories, and quotes.

## Daily limits

- Default: 10 analyses per day per client.
- Elevated: 50 analyses per day with admin password.

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
