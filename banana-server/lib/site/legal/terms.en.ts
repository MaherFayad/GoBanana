import type { LegalDoc } from "./types";

/** DRAFT terms of service. Needs legal review before launch. */
export const termsEn: LegalDoc = {
  title: "Terms of service",
  updated: "2026-10-11",
  intro: [
    "These terms are an agreement between you and [legal entity name, commercial registration number] (\"we\") for the use of {app}. By creating an account or using {app}, you accept them.",
  ],
  sections: [
    {
      id: "service",
      heading: "The service",
      paragraphs: [
        "{app} is a server your AI agent connects to, plus a moodboard canvas on the web. It turns a design brief into directions using fixed rules and word lists, finds references through web search, and exports files such as DESIGN.md and AGENTS.md. {app} makes no AI calls and does not generate images.",
      ],
    },
    {
      id: "account",
      heading: "Your account",
      list: [
        "You sign in through WorkOS. Keep your sign-in secure; you are responsible for activity on your account.",
        "You must be 18 or older and able to enter a binding agreement.",
        "One person per account. Do not share or resell access.",
      ],
    },
    {
      id: "plans",
      heading: "Plans, payment and tax",
      list: [
        "Plans and limits are listed on the pricing page: Free, Pro monthly ($5 per month), Pro yearly ($39 per year) and Founding ($29 once, first 100 buyers).",
        "Our order process is run by Paddle.com, our online reseller and Merchant of Record. Paddle handles payments, sales tax and VAT, invoices, refunds and billing questions. Paddle's buyer terms apply to your purchase.",
        "Subscriptions renew automatically until you cancel. When you cancel, Pro stays active until the end of the paid period and then your account returns to Free.",
        "The Founding plan is a single payment for Pro features (with 200 searches per month) for as long as {app} is offered. It is not a subscription and is not transferable.",
        "If you go over a limit, the tool tells you and stops that action until the next month or an upgrade.",
        "We may change prices for new purchases. We will tell subscribers at least 30 days before a price change applies to them.",
      ],
    },
    {
      id: "references",
      heading: "Third-party references",
      paragraphs: [
        "References are links to images on other sites, found through web search. {app} does not copy or host them, and every reference shows its source link. The rights in those images belong to their owners. Before you use any image beyond inspiration, check its license with the owner.",
      ],
    },
    {
      id: "content",
      heading: "Your content",
      paragraphs: [
        "You own your canvases, notes and uploads. You give us permission to store and display them only to run the service for you, including on share links you create. You confirm you have the right to upload what you upload.",
      ],
    },
    {
      id: "sharing",
      heading: "Share links",
      paragraphs: [
        "Pro plans can create share links. A share link is unlisted and view only, and search engines are told not to index it, but anyone with the link can see the canvas. You can turn a share link off at any time.",
      ],
    },
    {
      id: "use",
      heading: "Acceptable use",
      list: [
        "No illegal content, and no content that infringes the rights of others.",
        "No attempts to break, overload or get around the limits or security of the service.",
        "No automated access other than through an AI agent using the published MCP tools.",
        "No use of {app} to collect personal data about other people.",
      ],
    },
    {
      id: "takedown",
      heading: "Takedown requests",
      paragraphs: [
        "If a reference links to your work and you want it removed from {app}, send the takedown form. We review each request and, if approved, block the link or the whole domain everywhere in {app}, including shared canvases.",
      ],
    },
    {
      id: "availability",
      heading: "Availability and changes",
      paragraphs: [
        "We work to keep {app} available but do not promise it will always be available or free of errors. We may change or stop features. If we close the service, we will give at least 30 days notice so you can export your work.",
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      paragraphs: [
        "{app} is provided as is. To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under consumer protection law.",
      ],
    },
    {
      id: "ending",
      heading: "Ending the agreement",
      paragraphs: [
        "You can delete your account at any time from the account page. We may suspend or close an account that breaks these terms, after notice where reasonable.",
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      paragraphs: ["These terms are governed by the laws of the Kingdom of Saudi Arabia, and its courts have jurisdiction. [Legal review: confirm.]"],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      paragraphs: ["If we make an important change, we will update the date above and tell signed-in users before it takes effect."],
    },
    {
      id: "contact",
      heading: "Contact",
      paragraphs: ["Questions about these terms: {contact}."],
    },
  ],
};
