# Privacy Policy — LinkedIn Bullshit Detector

Last updated: 2026-03-24

## Overview

LinkedIn Bullshit Detector analyzes visible LinkedIn profile content to generate a score and breakdown.
The extension sends extracted profile text to a backend API, which forwards the request to OpenAI to generate analysis results.

## Data we process

The extension may process the following categories of data from LinkedIn pages:

- Website content (profile text, including headline, about, experience, education, skills, and visible posts)
- Browsing activity limited to supported LinkedIn profile URLs used by the extension

The extension does not require account creation.

## How data is used

Data is used only to:

- Generate the analysis result requested by the user
- Enforce daily analysis limits (10/day by default, up to 50/day with admin password flow)
- Return the result in the popup UI

## Data sharing

To produce analysis output, profile text is transmitted to:

- The extension backend API (self-hosted or Vercel deployment)
- OpenAI API (as the language model provider)

No data is sold.

## Data retention

- The extension itself does not persist a full history of analyzed profiles.
- Daily usage counters are tracked server-side for quota control.
- Temporary processing and network logs may exist on infrastructure providers (hosting, CDN, API providers) according to their own retention policies.

## Security

- The OpenAI API key is stored server-side and is not embedded in the extension package.
- Client requests are validated by the backend before forwarding.

## Your choices

- You can stop data processing at any time by uninstalling the extension.
- You can avoid sending profile data by not running analysis.

## Contact

For privacy questions, contact the developer via the repository owner profile:
https://github.com/MyMotox
