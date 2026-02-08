import { z } from "zod";
import { ToolConfig, ToolContext } from '../../types.js';
import { parseAnalyticsResponse, parseDemographics, parseGeographic, parseSubscriberAnalytics } from '../../utils/parsers/analytics.js';
import { formatDemographics, formatGeographicDistribution, formatSubscriberAnalytics } from '../../utils/formatters/audience.js';


export const audienceTools: ToolConfig[] = [
  {
    name: "get_video_demographics",
    description: "Get audience demographics (age/gender breakdown) for channel or specific video",
    category: "audience",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getDemographics({ startDate, endDate, videoId, metrics: [] });
        
        // Parse and format the data
        const parsedData = parseAnalyticsResponse(rawData);
        const demographicData = parseDemographics(parsedData);
        const formattedText = formatDemographics(demographicData);
        
        return {
          content: [{
            type: "text",
            text: `Demographics Analysis (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n${formattedText}`
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
    name: "get_geographic_distribution",
    description: "Get viewer geographic distribution by country for audience insights",
    category: "audience",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getGeographicDistribution({ startDate, endDate, videoId, metrics: [] });
        
        // Parse and format the data
        const parsedData = parseAnalyticsResponse(rawData);
        const geographicData = parseGeographic(parsedData);
        const formattedText = formatGeographicDistribution(geographicData);
        
        return {
          content: [{
            type: "text",
            text: `Geographic Distribution (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n${formattedText}`
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
    name: "get_subscriber_analytics",
    description: "Get subscriber vs non-subscriber view analytics for growth insights",
    category: "audience",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getSubscriberAnalytics({ startDate, endDate, videoId, metrics: [] });
        
        // Parse and format the data
        const parsedData = parseAnalyticsResponse(rawData);
        const subscriberData = parseSubscriberAnalytics(parsedData);
        const formattedText = formatSubscriberAnalytics(subscriberData);
        
        return {
          content: [{
            type: "text",
            text: `Subscriber Analytics (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n${formattedText}`
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
    name: "get_device_analytics",
    description: "Get device type and operating system breakdown showing how viewers watch your content (mobile, desktop, tablet, TV, etc.)",
    category: "audience",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getDeviceTypeAnalytics({
          startDate, endDate, videoId, metrics: []
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        // Aggregate by device type
        const deviceMap: { [device: string]: { views: number; watchTime: number; avgDuration: number; count: number } } = {};
        let totalViews = 0;

        rows.forEach((row: any[]) => {
          const deviceType = row[headers.indexOf('deviceType')] || 'Unknown';
          const views = Number(row[headers.indexOf('views')] || 0);
          const watchTime = Number(row[headers.indexOf('estimatedMinutesWatched')] || 0);
          const avgDuration = Number(row[headers.indexOf('averageViewDuration')] || 0);

          if (!deviceMap[deviceType]) {
            deviceMap[deviceType] = { views: 0, watchTime: 0, avgDuration: 0, count: 0 };
          }
          deviceMap[deviceType].views += views;
          deviceMap[deviceType].watchTime += watchTime;
          deviceMap[deviceType].avgDuration += avgDuration;
          deviceMap[deviceType].count++;
          totalViews += views;
        });

        let output = `Device Analytics (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n`;
        output += `Total Views Analyzed: ${totalViews.toLocaleString()}\n\n`;

        const sorted = Object.entries(deviceMap).sort((a, b) => b[1].views - a[1].views);
        sorted.forEach(([device, data]) => {
          const pct = totalViews > 0 ? ((data.views / totalViews) * 100).toFixed(1) : '0.0';
          const avgDur = data.count > 0 ? (data.avgDuration / data.count).toFixed(1) : '0.0';
          output += `${device}: ${data.views.toLocaleString()} views (${pct}%) | ${data.watchTime.toLocaleString()} min | Avg ${avgDur}s\n`;
        });

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
