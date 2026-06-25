# Slack AI Member Intelligence Agent

![Status](https://img.shields.io/badge/status-in%20development-orange)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Slack](https://img.shields.io/badge/Slack-Bolt-purple)
![OpenAI](https://img.shields.io/badge/OpenAI-LLM-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

An AI-powered Slack bot that automatically analyzes new community members, enriches their profiles using publicly available information, generates product-fit insights with AI, and posts recommendations to a private Slack channel.

---

## Why This Project?

Growing Slack communities often attract hundreds or thousands of members. Manually identifying high-value prospects, potential customers, partners, or power users becomes difficult as the community scales.

This project helps teams:

* Identify promising members early.
* Prioritize outreach efforts.
* Improve onboarding experiences.
* Discover potential customers or partners.
* Automate community intelligence workflows.

---

## 🚧 Project Status

This project is currently under active development and is not yet production-ready.

### Implemented

* Slack workspace join detection (`team_join`)
* Slack channel join detection (`member_joined_channel`)
* User profile retrieval
* Company website discovery
* GitHub user lookup
* AI-powered fit analysis
* Slack notifications
* Health check endpoint
* Development testing endpoint
* Structured logging

### Planned

* Database persistence
* Retry and recovery workflows
* CRM integrations
* LinkedIn enrichment
* Analytics dashboard
* Queue-based processing
* Custom scoring models
* Multi-model AI support

### Known Limitations

* Database functions are not yet implemented.
* Public research sources are currently limited.
* GitHub profile matching is heuristic-based.
* AI responses require additional validation safeguards.
* API rate limiting has not yet been implemented.

---

## Features

### Automated Member Detection

The agent automatically reacts when:

* A new member joins the Slack workspace.
* A member joins a monitored channel.

### Public Profile Research

The system performs lightweight enrichment using:

* Company website information derived from business email domains.
* GitHub profile discovery.

### AI-Powered Analysis

Using LangChain and OpenAI, the bot generates:

* Product fit score (0–100)
* Key observations
* Engagement recommendations

### Slack Reporting

Results are posted directly into a private Slack channel where community managers, sales teams, or customer success teams can review them.

### Developer-Friendly

* Express API server
* Health monitoring endpoint
* Test endpoint for local development
* Structured application logging

---

## Architecture

```text
Slack Events
     │
     ▼
Slack AI Agent
     │
     ├── User Profile Lookup
     │
     ├── Public Research
     │      ├── Company Website
     │      └── GitHub Search
     │
     ├── AI Analysis
     │
     ├── Persistence Layer (Planned)
     │
     └── Slack Notification
```

---

## Tech Stack

* Node.js
* Express.js
* Slack Bolt SDK
* Slack Web API
* OpenAI
* LangChain
* Axios
* dotenv

---

## Prerequisites

Before running the application, ensure you have:

* Node.js 18+
* A Slack Workspace
* A Slack App configured with Socket Mode enabled
* An OpenAI API key

---

## Environment Variables

Create a `.env` file:

```env
# Slack
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_APP_TOKEN=
SLACK_PRIVATE_CHANNEL_ID=

# OpenAI
OPENAI_API_KEY=

# Company Context
COMPANY_NAME=
COMPANY_PRODUCT=

# App
PORT=3000
NODE_ENV=development
```

---

## Installation

### Clone the Repository

```bash
git clone https://github.com/kisinja/Slack-AI-Agent.git
cd slack-ai-member-agent
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create and populate the `.env` file.

### Start the Application

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

---

## Slack App Configuration

Required OAuth Scopes:

```text
users:read
users:read.email
channels:read
groups:read
chat:write
```

Required Event Subscriptions:

```text
team_join
member_joined_channel
```

Enable:

```text
Socket Mode
```

After installation, invite the bot to the private reporting channel and set the channel ID in:

```env
SLACK_PRIVATE_CHANNEL_ID=
```

---

## API Endpoints

### Health Check

```http
GET /health
```

Example Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-06-25T12:00:00.000Z"
}
```

### Test Analysis Endpoint (Development Only)

```http
POST /test/analyze-member
```

Request:

```json
{
  "memberInfo": {
    "name": "Jane Doe",
    "email": "jane@company.com",
    "title": "Engineering Manager"
  }
}
```

---

## Example Slack Output

```text
🔍 New Member: Jane Doe

Fit Score: 87/100

Email: jane@company.com
Title: Engineering Manager

Insights:
• Technical decision-maker
• Works at a growing technology company
• Likely product evaluator

Recommendations:
• Send onboarding resources
• Offer a product demo
• Introduce relevant community resources
```

---

## Privacy & Ethics

This project is designed to use publicly available information and Slack-provided profile data only.

Before deploying in production:

* Review applicable privacy laws.
* Inform community members about automated profiling if required.
* Limit data retention appropriately.
* Avoid collecting unnecessary personal information.

---

## Roadmap

* [ ] Database persistence
* [ ] CRM integrations
* [ ] LinkedIn enrichment
* [ ] Analytics dashboard
* [ ] Queue processing
* [ ] Custom scoring strategies
* [ ] Multi-model support
* [ ] Rate limiting and caching

---

## Contributing

Contributions, bug reports, and feature requests are welcome.

Because the project is still evolving, breaking changes may occur between releases.

---

## License

MIT License

---

## Author

Built to automate community intelligence, lead qualification, and member engagement inside Slack communities.
