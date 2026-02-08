import { z } from "zod";
import { ToolConfig, ToolContext } from '../../types.js';
import { parseAnalyticsResponse } from '../../utils/parsers/analytics.js';
import { parseChannelOverview, formatChannelOverview, parseComparisonData, formatComparisonMetrics } from '../../utils/formatters/health.js';


export const healthTools: ToolConfig[] = [
  {
    name: "get_channel_overview",
    description: "Get channel vital signs - views, watch time, subscriber changes, and growth patterns",
    category: "health",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)")
    }),
    handler: async ({ startDate, endDate }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getChannelOverview({ startDate, endDate });
        
        // Parse and format the data
        const parsedData = parseAnalyticsResponse(rawData);
        const overviewData = parseChannelOverview(parsedData);
        const formattedText = formatChannelOverview(overviewData, `${startDate} to ${endDate}`);
        
        return {
          content: [{
            type: "text",
            text: `Channel Overview (${startDate} to ${endDate}):\n\n${formattedText}`
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
    name: "get_comparison_metrics",
    description: "Compare channel metrics between two time periods to identify growth or decline trends",
    category: "health",
    schema: z.object({
      metrics: z.array(z.string()).describe("Metrics to compare (e.g., views, estimatedMinutesWatched, subscribersGained)"),
      period1Start: z.string().describe("Period 1 start date (YYYY-MM-DD)"),
      period1End: z.string().describe("Period 1 end date (YYYY-MM-DD)"),
      period2Start: z.string().describe("Period 2 start date (YYYY-MM-DD)"),
      period2End: z.string().describe("Period 2 end date (YYYY-MM-DD)")
    }),
    handler: async ({ metrics, period1Start, period1End, period2Start, period2End }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawComparison = await youtubeClient.getComparisonMetrics({
          metrics,
          period1Start,
          period1End,
          period2Start,
          period2End
        });
        
        // Parse and format the data
        const comparisonData = parseComparisonData(rawComparison);
        if (!comparisonData) {
          throw new Error("Failed to parse comparison data");
        }
        const formattedText = formatComparisonMetrics(comparisonData);
        
        return {
          content: [{
            type: "text",
            text: `Comparison Metrics:
Period 1 (${period1Start} to ${period1End}) vs Period 2 (${period2Start} to ${period2End})

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
    name: "get_average_view_percentage",
    description: "Get average view percentage (what % of videos viewers actually watch) for a date range",
    category: "health",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)")
    }),
    handler: async ({ startDate, endDate }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const result = await youtubeClient.getChannelAnalytics({
          startDate,
          endDate,
          metrics: ['averageViewPercentage']
        });
        
        const percentage = result.rows?.[0]?.[0];
        return {
          content: [{
            type: "text",
            text: `Average View Percentage (${startDate} to ${endDate}): ${percentage}%\n\nThis shows what percentage of your videos viewers actually watch on average, accounting for different video lengths.`
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
    name: "get_watch_time_metrics",
    description: "Get daily watch time breakdown including minutes watched, average view duration, and average view percentage",
    category: "health",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific analysis")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getWatchTimeMetrics({
          startDate, endDate, videoId, metrics: []
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        let totalMinutes = 0;
        let totalViews = 0;
        let avgDurationSum = 0;
        let avgPercentSum = 0;

        rows.forEach((row: any[]) => {
          headers.forEach((header, idx) => {
            const val = Number(row[idx] || 0);
            switch (header) {
              case 'estimatedMinutesWatched': totalMinutes += val; break;
              case 'views': totalViews += val; break;
              case 'averageViewDuration': avgDurationSum += val; break;
              case 'averageViewPercentage': avgPercentSum += val; break;
            }
          });
        });

        const dayCount = rows.length || 1;
        let output = `Watch Time Metrics (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n`;
        output += `Total Watch Time: ${totalMinutes.toLocaleString()} minutes (${(totalMinutes / 60).toFixed(1)} hours)\n`;
        output += `Total Views: ${totalViews.toLocaleString()}\n`;
        output += `Average View Duration: ${(avgDurationSum / dayCount).toFixed(1)} seconds\n`;
        output += `Average View Percentage: ${(avgPercentSum / dayCount).toFixed(1)}%\n`;
        output += `Days Analyzed: ${dayCount}\n`;
        output += `Average Daily Watch Time: ${(totalMinutes / dayCount).toFixed(0)} minutes/day`;

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
    name: "get_revenue_metrics",
    description: "Get revenue analytics including estimated revenue, ad revenue, YouTube Premium revenue, CPM, and playback-based CPM",
    category: "health",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      videoId: z.string().optional().describe("Optional video ID for video-specific revenue")
    }),
    handler: async ({ startDate, endDate, videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getRevenueMetrics({ startDate, endDate, videoId });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        let totalRevenue = 0;
        let totalAdRevenue = 0;
        let totalRedRevenue = 0;
        let totalGrossRevenue = 0;
        let totalViews = 0;
        let cpmSum = 0;
        let pbCpmSum = 0;

        rows.forEach((row: any[]) => {
          headers.forEach((header, idx) => {
            const val = Number(row[idx] || 0);
            switch (header) {
              case 'estimatedRevenue': totalRevenue += val; break;
              case 'estimatedAdRevenue': totalAdRevenue += val; break;
              case 'estimatedRedPartnerRevenue': totalRedRevenue += val; break;
              case 'grossRevenue': totalGrossRevenue += val; break;
              case 'views': totalViews += val; break;
              case 'cpm': cpmSum += val; break;
              case 'playbackBasedCpm': pbCpmSum += val; break;
            }
          });
        });

        const dayCount = rows.length || 1;
        let output = `Revenue Metrics (${startDate} to ${endDate})${videoId ? ` for video ${videoId}` : ''}:\n\n`;
        output += `Estimated Revenue: $${totalRevenue.toFixed(2)}\n`;
        output += `  Ad Revenue: $${totalAdRevenue.toFixed(2)}\n`;
        output += `  YouTube Premium Revenue: $${totalRedRevenue.toFixed(2)}\n`;
        output += `Gross Revenue: $${totalGrossRevenue.toFixed(2)}\n\n`;
        output += `Average CPM: $${(cpmSum / dayCount).toFixed(2)}\n`;
        output += `Average Playback-Based CPM: $${(pbCpmSum / dayCount).toFixed(2)}\n`;
        output += `Total Views: ${totalViews.toLocaleString()}\n`;
        output += `Revenue Per 1K Views: $${totalViews > 0 ? ((totalRevenue / totalViews) * 1000).toFixed(2) : '0.00'}\n`;
        output += `Daily Average Revenue: $${(totalRevenue / dayCount).toFixed(2)}/day\n`;
        output += `\nNote: Revenue data requires monetization to be enabled on the channel.`;

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
    name: "get_top_videos",
    description: "Get top performing videos ranked by a chosen metric (views, watch time, likes, comments, shares, subscribers gained)",
    category: "health",
    schema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      metric: z.string().optional().describe("Metric to sort by: views (default), estimatedMinutesWatched, likes, comments, shares, subscribersGained"),
      maxResults: z.number().optional().describe("Number of top videos to return (default 10, max 50)")
    }),
    handler: async ({ startDate, endDate, metric, maxResults }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const rawData = await youtubeClient.getTopVideos({
          startDate, endDate,
          metric: metric || 'views',
          maxResults: Math.min(maxResults || 10, 50)
        });

        const parsedData = parseAnalyticsResponse(rawData);
        const headers = parsedData.columnHeaders?.map(h => h.name) || [];
        const rows = parsedData.rows || [];

        const sortMetric = metric || 'views';
        let output = `Top Videos by ${sortMetric} (${startDate} to ${endDate}):\n\n`;

        if (rows.length === 0) {
          output += "No video data available for this period.";
        } else {
          rows.forEach((row: any[], index: number) => {
            const videoId = row[headers.indexOf('video')] || 'unknown';
            const views = Number(row[headers.indexOf('views')] || 0);
            const watchTime = Number(row[headers.indexOf('estimatedMinutesWatched')] || 0);
            const likes = Number(row[headers.indexOf('likes')] || 0);
            const comments = Number(row[headers.indexOf('comments')] || 0);
            const shares = Number(row[headers.indexOf('shares')] || 0);
            const subsGained = Number(row[headers.indexOf('subscribersGained')] || 0);
            const avgDuration = Number(row[headers.indexOf('averageViewDuration')] || 0);
            const avgPercent = Number(row[headers.indexOf('averageViewPercentage')] || 0);

            output += `${index + 1}. Video: ${videoId}\n`;
            output += `   Views: ${views.toLocaleString()} | Watch Time: ${watchTime.toLocaleString()} min\n`;
            output += `   Likes: ${likes.toLocaleString()} | Comments: ${comments.toLocaleString()} | Shares: ${shares.toLocaleString()}\n`;
            output += `   Subscribers Gained: ${subsGained.toLocaleString()}\n`;
            output += `   Avg Duration: ${avgDuration.toFixed(1)}s | Avg View %: ${avgPercent.toFixed(1)}%\n\n`;
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
