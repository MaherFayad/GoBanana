import type { LegalDoc } from "./types";

/** DRAFT privacy notice, written with the Saudi PDPL in mind. Needs legal review before launch. */
export const privacyEn: LegalDoc = {
  title: "Privacy notice",
  updated: "2026-10-11",
  intro: [
    "This notice explains what personal data {app} collects, why, how long we keep it, who processes it for us, and the rights you have. We wrote it with the Saudi Personal Data Protection Law (PDPL) and its Implementing Regulations in mind.",
    "Controller: [legal entity name, commercial registration number, address in Saudi Arabia]. Contact: {contact}.",
  ],
  sections: [
    {
      id: "data",
      heading: "Data we collect",
      list: [
        "Account data: your email address and your WorkOS user id, created when you sign in.",
        "Canvas content: canvas titles, briefs, notes, layout, palettes, and the links and titles of references you save.",
        "Your uploads: images you choose to upload to your own canvases (Pro plans).",
        "Usage counts: the number of searches and canvases per month, used for plan limits.",
        "Billing data: your plan and your Paddle customer id. Paddle collects your payment details; we never see your card number.",
        "Share links: a random token for each canvas you share.",
        "Takedown requests: the name, email and details you send in the takedown form.",
        "Technical data: IP address and request details that our hosting provider processes to deliver the service and block abuse.",
      ],
    },
    {
      id: "images",
      heading: "Reference images are not stored",
      paragraphs: [
        "{app} does not download, store or host images found on other sites. We store only links and basic details such as the title, size and source site. The image loads in your browser straight from the source site, so that site may see your IP address and browser details under its own privacy policy.",
        "To pick colors, {app} may read a small preview image in memory for a moment and then drop it. It is never saved.",
      ],
    },
    {
      id: "purposes",
      heading: "Why we use your data and our lawful basis",
      list: [
        "To run your account, save your canvases and provide the features you ask for. Basis: performing our agreement with you.",
        "To apply plan limits and process payments through Paddle. Basis: performing our agreement with you.",
        "To keep the service secure and prevent abuse. Basis: our legitimate interest in a safe service, which does not override your rights.",
        "To handle takedown requests and meet legal duties. Basis: legal obligation and legitimate interest.",
        "We do not sell personal data, do not use it for advertising, and do not use it to train AI models.",
      ],
    },
    {
      id: "ai",
      heading: "Your AI agent",
      paragraphs: [
        "{app} makes no AI calls. When you use {app} from Claude, ChatGPT, Cursor or another agent, that agent receives the results of each tool call. The agent's own privacy policy applies to what it receives.",
      ],
    },
    {
      id: "retention",
      heading: "How long we keep data",
      list: [
        "Account data, canvases, uploads and usage counts: while your account is open. When you delete your account, we delete these records and your uploaded files.",
        "References found by search but not placed on a canvas: deleted automatically after 30 days.",
        "Database backups: overwritten within [30] days of deletion.",
        "Takedown requests: kept while the block is in place and for up to [3] years after, to show how we handled the request.",
        "Billing records: Paddle keeps them as required by tax law, under Paddle's own privacy notice.",
      ],
    },
    {
      id: "processors",
      heading: "Who processes data for us",
      paragraphs: ["We use these providers. Each one processes data only to provide its service to us, under a data processing agreement."],
      table: {
        caption: "Service providers",
        head: ["Provider", "Purpose", "Data", "Location"],
        rows: [
          ["Cloudflare", "Hosting, network, storage of your uploads", "Request data, uploads, all data in transit", "Global network, including outside Saudi Arabia"],
          ["Neon", "Database", "Account data, canvases, references, usage", "[Region to confirm], outside Saudi Arabia"],
          ["WorkOS", "Sign in", "Email, WorkOS user id, sign-in events", "United States"],
          ["Paddle", "Payments, tax and invoices", "Name, email, billing address, payment details, Paddle customer id", "United Kingdom and United States"],
          ["Serper", "Web image search", "Search terms made from your brief, with no account details", "United States"],
        ],
      },
    },
    {
      id: "transfers",
      heading: "Transfers outside Saudi Arabia",
      paragraphs: [
        "The providers above process data outside the Kingdom. We transfer only the data each one needs, and we rely on the conditions in the Regulation on Personal Data Transfer outside the Kingdom, such as appropriate safeguards and standard contractual clauses. [Legal review: confirm the transfer basis for each provider.]",
      ],
    },
    {
      id: "rights",
      heading: "Your rights",
      list: [
        "Know how your data is used (this notice).",
        "Access your data and get a copy in a readable format.",
        "Correct data that is wrong or incomplete.",
        "Delete your data. You can delete your account at any time from the account page.",
        "Withdraw consent where we rely on it.",
        "Complain to the Saudi Data and AI Authority (SDAIA).",
      ],
      paragraphs: ["To use a right, email {contact}. We reply within 30 days. We may ask you to confirm your identity first."],
    },
    {
      id: "takedown",
      heading: "Takedown requests",
      paragraphs: [
        "If a reference links to your work and you want it removed from {app}, use the takedown form. We review each request, usually within 5 working days. If approved, we block the link or the whole domain, so it no longer shows in search results or on any canvas, including shared ones. The image itself stays on the site that hosts it.",
      ],
    },
    {
      id: "security",
      heading: "Security",
      paragraphs: [
        "Data travels over HTTPS. Access to the database and storage is limited to the service. We never log sign-in tokens, API keys or image bytes. If a breach puts your data at risk, we will tell you and the authority as the law requires.",
      ],
    },
    {
      id: "cookies",
      heading: "Cookies",
      paragraphs: ["We use only the cookies needed to keep you signed in and to complete checkout. We do not use advertising cookies."],
    },
    {
      id: "children",
      heading: "Children",
      paragraphs: ["{app} is not meant for people under 18, and we do not knowingly collect their data."],
    },
    {
      id: "changes",
      heading: "Changes to this notice",
      paragraphs: ["If we make an important change, we will update the date above and tell signed-in users before it takes effect."],
    },
    {
      id: "contact",
      heading: "Contact",
      paragraphs: ["Questions or requests about your data: {contact}."],
    },
  ],
};
