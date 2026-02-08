import { z } from "zod";
import { ToolConfig, ToolContext } from '../../types.js';
import { formatChannelInfo, formatVideoList } from '../../utils/formatters/channel.js';


export const channelTools: ToolConfig[] = [
  {
    name: "get_channel_info",
    description: "Get information about the authenticated YouTube channel",
    category: "channel",
    schema: z.object({}),
    handler: async (_, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const channelInfo = await youtubeClient.getChannelInfo();
        const formattedText = formatChannelInfo(channelInfo);
        
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
    name: "get_channel_videos",
    description: "Get list of channel videos with optional filters for demographic analysis",
    category: "channel",
    schema: z.object({
      query: z.string().optional().describe("Optional search query to filter videos"),
      startDate: z.string().optional().describe("Optional start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("Optional end date (YYYY-MM-DD)"),
      maxResults: z.number().optional().default(25).describe("Number of videos to return (default 25, max 50)")
    }),
    handler: async ({ query, startDate, endDate, maxResults = 25 }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const videos = await youtubeClient.searchChannelVideos({
          query,
          startDate,
          endDate,
          maxResults: Math.min(maxResults, 50)
        });

        const formattedText = formatVideoList({ videos, filterOptions: { query, startDate, endDate } });

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
    name: "get_video_details",
    description: "Get detailed info for a specific video including title, description, tags, stats, duration, and content details",
    category: "channel",
    schema: z.object({
      videoId: z.string().describe("Video ID to get details for")
    }),
    handler: async ({ videoId }, { getYouTubeClient }: ToolContext) => {
      try {
        const youtubeClient = await getYouTubeClient();
        const video = await youtubeClient.getVideoDetails(videoId);

        let output = `Video Details for ${videoId}:\n\n`;
        output += `Title: ${video.snippet.title}\n`;
        output += `Published: ${video.snippet.publishedAt}\n`;
        output += `Duration: ${video.contentDetails.duration}\n`;
        output += `Definition: ${video.contentDetails.definition}\n`;
        output += `Caption: ${video.contentDetails.caption}\n\n`;

        output += `Statistics:\n`;
        output += `  Views: ${Number(video.statistics.viewCount).toLocaleString()}\n`;
        output += `  Likes: ${Number(video.statistics.likeCount).toLocaleString()}\n`;
        output += `  Comments: ${Number(video.statistics.commentCount).toLocaleString()}\n\n`;

        if (video.snippet.tags && video.snippet.tags.length > 0) {
          output += `Tags: ${video.snippet.tags.join(', ')}\n\n`;
        }

        output += `Description:\n${video.snippet.description}`;

        return {
          content: [{
            type: "text",
            text: output
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
];
