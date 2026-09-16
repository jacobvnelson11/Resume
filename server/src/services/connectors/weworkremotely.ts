import Parser from "rss-parser";
import type { NormalizedJob } from "../../types.js";

const parser = new Parser();

/**
 * We Work Remotely publishes an official per-category RSS feed meant for
 * programmatic consumption (PRD section 9) -- no scraping of the HTML site.
 * Listing titles are formatted "Company: Job Title".
 */
export async function fetchWeWorkRemotelyJobs(): Promise<NormalizedJob[]> {
  const feedUrl = "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss";
  let feed;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (err) {
    console.warn(`[weworkremotely] feed fetch failed:`, err);
    return [];
  }

  return (feed.items ?? [])
    .filter((item) => item.link && item.title)
    .map((item) => {
      const [company, ...titleParts] = (item.title ?? "").split(":");
      const title = titleParts.length > 0 ? titleParts.join(":").trim() : item.title ?? "";
      const description = stripHtml(item.contentSnippet ?? item.content ?? "");

      return {
        externalId: item.guid ?? item.link!,
        title: title || item.title || "Unknown role",
        company: company?.trim() || "Unknown",
        source: "weworkremotely",
        url: item.link!,
        remoteText: "remote",
        description,
        salaryMin: extractSalaryFromText(description),
        postedAt: item.pubDate ? new Date(item.pubDate) : null,
      } satisfies NormalizedJob;
    });
}

function extractSalaryFromText(text: string): number | null {
  const match = text.match(/\$([\d]{2,3}),?(\d{3})(?:\s*-|\s*to)?/);
  if (!match) return null;
  return Number(`${match[1]}${match[2]}`);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
