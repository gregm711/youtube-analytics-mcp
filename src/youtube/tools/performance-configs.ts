import { z } from "zod";
import { ToolConfig, ToolContext } from '../../types.js';
import { parseAnalyticsResponse } from '../../utils/parsers/analytics.js';
import { analyzeAudienceRetention, formatAudienceRetention, findDropOffPoints, formatRetentionDropoffs } from '../../utils/formatters/performance.js';


export const performanceTools: ToolConfig[] = [
  {
    name: "get_audience_retention",
    description: "Track where viewers leave videos - identifies hook problems, pacing issues, and engagement drops",
    category: "performance",
    schema: z.object({
      videoId: z.string().describe("Video ID to analyze"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)")
    }),
    handler: async ({ videoId, startDate, endDate }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getAudienceRetention({ 
          videoId, startDate, endDate, metrics: [] 
        });
        
        // Parse and analyze the data
        const parsedData = parseAnalyticsResponse(rawData);
        const analysis = analyzeAudienceRetention(parsedData);
        const formattedText = formatAudienceRetention(analysis);
        
        return {
          content: [{
            type: "text",
            text: `Audience Retention for video ${videoId} (${startDate} to ${endDate}):

${formattedText}`
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
    name: "get_retention_dropoff_points",
    description: "Find exact moments losing viewers with severity levels - surgical precision for content improvement",
    category: "performance",
    schema: z.object({
      videoId: z.string().describe("Video ID to analyze"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      threshold: z.number().optional().default(0.1).describe("Drop threshold (default 0.1 = 10%)")
    }),
    handler: async ({ videoId, startDate, endDate, threshold }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getAudienceRetention({ 
          videoId, startDate, endDate, metrics: [] 
        });
        
        // Parse and analyze the data
        const parsedData = parseAnalyticsResponse(rawData);
        const dropOffPoints = findDropOffPoints(parsedData, threshold);
        const formattedText = formatRetentionDropoffs(dropOffPoints);
        
        return {
          content: [{
            type: "text",
            text: `Retention Drop-off Points for video ${videoId}:

${formattedText}`
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
    name: "get_playlist_performance",
    description: "Get playlist performance metrics including starts, views per start, and average time in playlist",
    category: "performance",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      playlistId: z.string().optional().describe("Optional playlist ID for specific playlist analysis")
    }),
    handler: async ({ startDate, endDate, playlistId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getPlaylistPerformance({
          startDate, endDate, playlistId, metrics: []
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        let output = `Playlist Performance (${startDate} to ${endDate})${playlistId ? ` for playlist ${playlistId}` : ''}:\n\n`;

        if (rows.length === 0) {
          output += "No playlist data available for this period.";
        } else {
          rows.forEach((row: any[], index: number) => {
            const plId = row[headers.indexOf('playlist')] || 'unknown';
            const starts = Number(row[headers.indexOf('playlistStarts')] || 0);
            const viewsPerStart = Number(row[headers.indexOf('viewsPerPlaylistStart')] || 0);
            const avgTime = Number(row[headers.indexOf('averageTimeInPlaylist')] || 0);

            output += `${index + 1}. Playlist: ${plId}\n`;
            output += `   Starts: ${starts.toLocaleString()}\n`;
            output += `   Views Per Start: ${viewsPerStart.toFixed(1)}\n`;
            output += `   Average Time in Playlist: ${avgTime.toFixed(0)} seconds\n\n`;
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
  {
    name: "get_card_endscreen_performance",
    description: "Get card impressions, clicks, and click-through rate for a specific video's cards and end screens",
    category: "performance",
    schema: z.object({
      videoId: z.string().describe("Video ID to analyze"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)")
    }),
    handler: async ({ videoId, startDate, endDate }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getCardEndScreenPerformance({
          videoId, startDate, endDate
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        let output = `Card & End Screen Performance for video ${videoId} (${startDate} to ${endDate}):\n\n`;

        if (rows.length === 0) {
          output += "No card/end screen data available for this video and period.";
        } else {
          const row = rows[0];
          const impressions = Number(row[headers.indexOf('cardImpressions')] || 0);
          const clicks = Number(row[headers.indexOf('cardClicks')] || 0);
          const clickRate = Number(row[headers.indexOf('cardClickRate')] || 0);

          output += `Card Impressions: ${impressions.toLocaleString()}\n`;
          output += `Card Clicks: ${clicks.toLocaleString()}\n`;
          output += `Card Click Rate: ${(clickRate * 100).toFixed(2)}%\n\n`;

          if (impressions > 0) {
            if (clickRate > 0.05) {
              output += "Strong card performance - viewers are engaging with your cards.";
            } else if (clickRate > 0.02) {
              output += "Moderate card engagement. Consider more compelling card text or timing.";
            } else {
              output += "Low card engagement. Try placing cards at high-engagement moments in your video.";
            }
          }
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
  {
    name: "get_video_performance_over_time",
    description: "Get daily performance breakdown for a specific video showing views, watch time, likes, comments, and shares over time",
    category: "performance",
    schema: z.object({
      videoId: z.string().describe("Video ID to analyze"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)")
    }),
    handler: async ({ videoId, startDate, endDate }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getVideoPerformanceOverTime({
          videoId, startDate, endDate
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        let totalViews = 0;
        let totalWatchTime = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalSubsGained = 0;

        let output = `Video Performance Over Time: ${videoId} (${startDate} to ${endDate}):\n\n`;

        if (rows.length === 0) {
          output += "No data available for this video and period.";
        } else {
          output += "Daily Breakdown:\n";
          rows.forEach((row: any[]) => {
            const day = row[headers.indexOf('day')] || '';
            const views = Number(row[headers.indexOf('views')] || 0);
            const watchTime = Number(row[headers.indexOf('estimatedMinutesWatched')] || 0);
            const likes = Number(row[headers.indexOf('likes')] || 0);
            const comments = Number(row[headers.indexOf('comments')] || 0);
            const shares = Number(row[headers.indexOf('shares')] || 0);
            const subsGained = Number(row[headers.indexOf('subscribersGained')] || 0);

            totalViews += views;
            totalWatchTime += watchTime;
            totalLikes += likes;
            totalComments += comments;
            totalShares += shares;
            totalSubsGained += subsGained;

            output += `${day}: ${views.toLocaleString()} views | ${watchTime.toLocaleString()} min | ${likes} likes | ${comments} comments\n`;
          });

          output += `\nTotals:\n`;
          output += `  Views: ${totalViews.toLocaleString()}\n`;
          output += `  Watch Time: ${totalWatchTime.toLocaleString()} minutes (${(totalWatchTime / 60).toFixed(1)} hours)\n`;
          output += `  Likes: ${totalLikes.toLocaleString()}\n`;
          output += `  Comments: ${totalComments.toLocaleString()}\n`;
          output += `  Shares: ${totalShares.toLocaleString()}\n`;
          output += `  Subscribers Gained: ${totalSubsGained.toLocaleString()}\n`;
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
