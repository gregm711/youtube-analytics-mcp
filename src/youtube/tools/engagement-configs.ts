import { z } from "zod";
import { ToolConfig, ToolContext } from '../../types.js';
import { parseAnalyticsResponse, parseEngagementMetrics } from '../../utils/parsers/analytics.js';
import { analyzeEngagement, formatEngagementMetrics } from '../../utils/formatters/engagement.js';


export const engagementTools: ToolConfig[] = [
  {
    name: "get_engagement_metrics",
    description: "Get engagement metrics (likes/comments/shares analysis) to measure viewer emotional investment and content interaction quality",
    category: "engagement",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getEngagementMetrics({ 
          startDate, endDate, videoId 
        });
        
        // Parse the raw data
        const parsedData = parseAnalyticsResponse(rawData);
        const metrics = parseEngagementMetrics(parsedData);
        
        // Analyze and format the data
        const analysis = analyzeEngagement(metrics);
        const formattedText = formatEngagementMetrics(analysis, { startDate, endDate, videoId });
        
        return {
          content: [{
            type: "text",
            text: formattedText
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    },
  },
  {
    name: "get_sharing_analytics",
    description: "Get sharing service breakdown showing where viewers share your content (WhatsApp, Twitter, Facebook, email, etc.)",
    category: "engagement",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getSharingAnalytics({
          startDate, endDate, videoId
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        let totalShares = 0;
        const services: { name: string; shares: number }[] = [];

        rows.forEach((row: any[]) => {
          const service = row[headers.indexOf('sharingService')] || 'Unknown';
          const shares = Number(row[headers.indexOf('shares')] || 0);
          services.push({ name: service, shares });
          totalShares += shares;
        });

        let output = `Sharing Analytics (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n`;
        output += `Total Shares: ${totalShares.toLocaleString()}\n\n`;

        if (services.length === 0) {
          output += "No sharing data available for this period.";
        } else {
          output += "Sharing Services (by shares):\n";
          services.forEach((service, index) => {
            const pct = totalShares > 0 ? ((service.shares / totalShares) * 100).toFixed(1) : '0.0';
            output += `${index + 1}. ${service.name}: ${service.shares.toLocaleString()} shares (${pct}%)\n`;
          });
        }

        return {
          content: [{ type: "text", text: output }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    },
  },
];
