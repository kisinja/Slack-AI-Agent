import pkg from "@slack/bolt";
const { App } = pkg;
import { WebClient } from "@slack/web-api";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import express from "express";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const log = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) =>
    process.env.NODE_ENV === "development" &&
    console.debug(`[DEBUG] ${message}`, ...args),
};

class SlackAIAgent {
  constructor() {
    this.app = express();
    this.slack = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
    });
    this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.openai = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4",
      temperature: 0.3,
    });

    this.setupSlackEvents();
    this.setupExpress();
  }

  setupSlackEvents() {
    this.slack.event("team_join", async ({ event }) => {
      try {
        log.info(`New user joined: ${event.user.real_name || event.user.name}`);

        const userInfo = await this.getUserInfo(event.user.id);
        await this.analyzeAndPostMember(userInfo);
      } catch (err) {
        log.error("Error processing team_join event:", err);
      }
    });

    this.slack.event("member_joined_channel", async ({ event }) => {
      try {
        if (event.channel_type === "C") {
          log.info(
            `Member ${event.user} joined channel ${event.channel}. Fetching user info...`,
          );
          const userInfo = await this.getUserInfo(event.user);
          await this.analyzeAndPostMember(userInfo);
        }
      } catch (e) {
        log.error("Error processing member_joined_channel event:", e);
      }
    });

    this.slack.error(async (error) => log.error("Slack error:", error.message));
  }

  setupExpress() {
    this.app.use(express.json());

    this.app.get("/health", (req, res) => {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    });

    if (process.env.NODE_ENV === "development") {
      this.app.post("/test/analyze-member", async (req, res) => {
        try {
          const { memberInfo } = req.body;
          if (!memberInfo)
            return res.status(400).json({ error: "memberInfo is required" });
          const analysis = await this.analyzeAndPostMember(memberInfo);

          res.json({
            success: true,
            analysis,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          log.error("Test/analyze-member error:", err.message);
          res.status(500).json({ error: err.message });
        }
      });
    }

    this.app.use((err, req, res, next) => {
      log.error("Express error:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    });
  }

  async getUserInfo(userId) {
    const result = await this.webClient.users.info({
      user: userId,
    });
    const user = result.user;

    return {
      id: user.id,
      name: user.real_name || user.name,
      username: user.name,
      email: user.profile?.email,
      title: user.profile?.title,
      timezone: user.tz,
      profile: {
        firstName: user.profile?.first_name,
        lastName: user.profile?.last_name,
        statusText: user.profile?.status_text,
      },
    };
  }

  async analyzeAndPostMember(memberInfo) {
    let analysisId = null;
    try {
      log.info(`Processing member: ${memberInfo.name}`);
      const researchData = await this.doBasicResearch(memberInfo);
      const analysis = await this.analyzeWithAI(memberInfo, researchData);
      log.info(`Saving analysis to database for ${memberInfo.name}`);

      analysisId = await saveMemeberAnalysis(
        memberInfo,
        analysis,
        researchData,
      );

      await this.postAnalysisToChannel(memberInfo, analysis, researchData);

      if (analysisId) {
        await markAsSentToSlack(analysisId);
      }
    } catch (error) {
      log.error(`Error processing ${memberInfo.name}: ${error.message}`);
      if (analysisId) {
        log.info(
          `Analysis ${analysisId} saved to database but not sent to Slack due to error`,
        );
      }
      throw error;
    }
  }

  async doBasicResearch(memberInfo) {
    // gathers public available info about the member from github, e.t.c
    const results = [];

    try {
      if (memberInfo.email && !this.isPersonalEmail(memberInfo.email)) {
        const domain = memberInfo.email.split("@")[1];
        const companyInfo = await this.getCompanyInfo(domain);
        if (companyInfo) results.push(companyInfo);

        if (memberInfo.name) {
          const githubInfo = await this.getGithubInfo(memberInfo.name);
          if (githubInfo) results.push(githubInfo);
        }
      }
    } catch (error) {
      log.error("Research error:", error.message);
    }

    return results;
  }

  async getCompanyInfo(domain) {
    try {
      const response = await axios.get(`https://www.${domain}`, {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      const titleMatch = response.data.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : `Company: ${domain}`;

      return {
        url: `https://www.${domain}`,
        title: title,
        content: `Company website for ${domain}`,
        type: "company",
      };
    } catch (error) {
      log.error(`Could not fetch ${domain}: `, error.message);
      return null;
    }
  }

  async getGithubInfo(name) {
    try {
      const response = await axios.get(
        `https://api.github.com/search/users?q=${encodeURIComponent(name)}`,
        { timeout: 5000 },
      );
      if (response.data.items && response.data.items.length > 0) {
        const user = response.data.items[0];
        return {
          url: user.html_url,
          title: `GitHub: ${user.login}`,
          content: `${user.public_repos} public repositories`,
          type: "github",
        };
      }
    } catch (error) {
      log.debug("Github search error: ", error.message);
      return null;
    }
  }

  async analyzeWithAI(memberInfo, researchData) {
    // uses gpt 4 and langchain to analyse a members fit for the company's products
    const prompt = ChatPromptTemplate.fromTemplate(
      `
        Analyze this new community member for fit with our commercial product.

        Company: ${process.env.COMPANY_NAME || "Your Company"}
        Product: ${process.env.COMPANY_PRODUCT || "Your Product"}

        Member:
        - Name: {name}
        - Email: {email}
        - Title: {title}

        Research Data:
        {research}

        Provide a JSON response with:
        - fitScore (0-100): likelihood they'd be interested in our product
        - insights: array of 3-5 key observations
        - recommendations: array of 2-4 engagement suggestions

        Consider job title, company size, technical background, and budget authority.
      `,
    );

    try {
      const researchSummary =
        researchData.length > 0
          ? researchData.map((r) => `${r.title}: ${r.content}`).join(`\\n`)
          : "Limited research data available";

      const chain = prompt.pipe(this.openai);
      const result = await chain.invoke({
        name: memberInfo.name,
        email: memberInfo.email || "Not provided",
        title: memberInfo.title || "Not provided",
        research: researchSummary,
      });

      const responseText = result.content || result;

      const cleanedResponse = responseText
        .replace(/```json\\n?|\\n?```/g, "")
        .trim();

      const analysis = JSON.parse(cleanedResponse);

      return {
        fitScore: Math.max(0, Math.min(100, analysis.fitScore || 50)),
        insights: Array.isArray(analysis.insights)
          ? analysis.insights
          : ["Analysis completed"],
        recommendations: Array.isArray(analysis.recommendations)
          ? analysis.recommendations
          : ["Follow up is recommended"],
      };
    } catch (error) {
      log.error("AI analysis error:", error.message);
      return {
        fitScore: 50,
        insights: ["Unable to complete full analysis"],
        recommendations: ["Manual review recommended"],
      };
    }
  }

  async postAnalysisToChannel(member, analysis, researchData) {
    const color =
      analysis.fitScore >= 80
        ? "#36a64f"
        : analysis.fitScore >= 60
          ? "#ffb84d"
          : analysis.fitScore >= 40
            ? "#ff9500"
            : "#ff4444";

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: `🔍 New member: ${member.name}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Fit Score: *${analysis.fitScore}/100` },
          {
            type: "mrkdwn",
            text: `*Email:* ${member.email || "Not provided"}`,
          },
          {
            type: "mrkdwn",
            text: `*Title:* ${member.title || "Not provided"}`,
          },
        ],
      },
    ];

    if (analysis.insights.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Insights:*\\n${analysis.insights.map((i) => `• ${i}`).join("\\n")}`,
        },
      });
    }

    if (analysis.recommendations.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Recommendations:*\\n${analysis.recommendations.map((r) => `• ${r}`).join("\\n")}`,
        },
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📊 Analyzed: ${new Date().toISOString()}`,
        },
      ],
    });

    await this.webClient.chat.postMessage({
      channel: process.env.SLACK_PRIVATE_CHANNEL_ID,
      text: `New Member Analysis: ${member.name} (${analysis.fitScore}/100)`,
      blocks,
    });

    log.info(`Analysis posted to channel for ${member.name}`);
  }

  isPersonalEmail(memberEmail) {
    const personalDomains = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
    ];
    const domain = memberEmail.split("@")[1]?.toLowerCase();

    return personalDomains.includes(domain);
  }

  async start() {
    try {
      log.info("💾 Initializing database...");
      await initDatabase();

      const port = process.env.PORT || 3000;
      this.server = this.app.listen(port, () => {
        log.info(`🚀 Express server running on port ${port}`);
      });

      await this.slack.start();
      log.info("⚡Slack Bot connected");

      log.info("🎉 Slack AI Agent is running!");

      if (process.env.NODE_ENV === "development") {
        log.info(
          `Test endpoint: POST http://localhost:${port}/test/analyze-member`,
        );
      }
    } catch (error) {
      log.error("Failed to start: ", error.message);
      process.exit(1);
    }
  }

  async stop() {
    log.info("Shutting down...");
    try {
      await this.slack.stop();
      if (this.server) {
        await new Promise((resolve) => this.server.close(resolve));
      }

      await closeDatabase();
      log.info("Stopped successfully!");
    } catch (error) {
      log.error("Shutdown error: ", error.message);
    }
    process.exit(0);
  }


}
