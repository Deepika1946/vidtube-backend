import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const totalSubscribers = await Subscription.aggregate([
    { $match: { channel: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, subscribersCount: { $sum: 1 } } },
  ]);

  const video = await Video.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $project: {
        totalLikes: { $size: "$likes" },
        totalViews: "$views",
        totalVideos: { $literal: 1 },
      },
    },
    {
      $group: {
        _id: null,
        totalLikes: { $sum: "$totalLikes" },
        totalViews: { $sum: "$totalViews" },
        totalVideos: { $sum: 1 },
      },
    },
  ]);

  const channelStats = {
    totalSubscribers: totalSubscribers[0]?.subscribersCount || 0,
    totalLikes: video[0]?.totalLikes || 0,
    totalViews: video[0]?.totalViews || 0,
    totalVideos: video[0]?.totalVideos || 0,
  };

  return res.status(200).json(new ApiResponse(200, channelStats, "Channel stats fetched successfully"));
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const videos = await Video.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        createdAt: { $dateToParts: { date: "$createdAt" } },
        likesCount: { $size: "$likes" },
      },
    },
    {
      $sort: { "createdAt.year": -1, "createdAt.month": -1, "createdAt.day": -1 },
    },
    {
      $project: {
        title: 1, thumbnail: 1, isPublished: 1, views: 1, duration: 1,
        createdAt: { year: "$createdAt.year", month: "$createdAt.month", day: "$createdAt.day" },
        likesCount: 1,
      },
    },
  ]);

  return res.status(200).json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
