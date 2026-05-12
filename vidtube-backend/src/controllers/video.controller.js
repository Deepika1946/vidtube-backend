import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;

  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: { query, path: ["title", "description"] },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");
    pipeline.push({ $match: { owner: new mongoose.Types.ObjectId(userId) } });
  }

  pipeline.push({ $match: { isPublished: true } });
  pipeline.push({ $sort: { [sortBy]: sortType === "asc" ? 1 : -1 } });
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "owner",
      foreignField: "_id",
      as: "ownerDetails",
      pipeline: [{ $project: { username: 1, avatar: 1 } }],
    },
  });
  pipeline.push({ $unwind: "$ownerDetails" });

  const videoAggregate = Video.aggregate(pipeline);
  const options = { page: parseInt(page), limit: parseInt(limit) };
  const videos = await Video.aggregatePaginate(videoAggregate, options);

  return res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) throw new ApiError(400, "Title and description are required");

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath) throw new ApiError(400, "Video file is required");
  if (!thumbnailLocalPath) throw new ApiError(400, "Thumbnail is required");

  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile) throw new ApiError(400, "Video upload failed");
  if (!thumbnail) throw new ApiError(400, "Thumbnail upload failed");

  const video = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: videoFile.duration,
    owner: req.user?._id,
    isPublished: false,
  });

  const uploadedVideo = await Video.findById(video._id);
  if (!uploadedVideo) throw new ApiError(500, "Video upload failed");

  return res.status(201).json(new ApiResponse(200, uploadedVideo, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const video = await Video.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: { if: { $in: [req.user?._id, "$subscribers.subscriber"] }, then: true, else: false },
              },
            },
          },
          { $project: { username: 1, avatar: 1, subscribersCount: 1, isSubscribed: 1 } },
        ],
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        owner: { $first: "$owner" },
        isLiked: { $cond: { if: { $in: [req.user?._id, "$likes.likedBy"] }, then: true, else: false } },
      },
    },
    {
      $project: {
        videoFile: 1, title: 1, description: 1, views: 1, createdAt: 1,
        duration: 1, comments: 1, owner: 1, likesCount: 1, isLiked: 1,
      },
    },
  ]);

  if (!video?.length) throw new ApiError(404, "Video not found");

  await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
  await User.findByIdAndUpdate(req.user?._id, { $addToSet: { watchHistory: videoId } });

  return res.status(200).json(new ApiResponse(200, video[0], "Video details fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");
  if (!title || !description) throw new ApiError(400, "Title and description are required");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video?.owner.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  const thumbnailLocalPath = req.file?.path;
  let thumbnail;
  if (thumbnailLocalPath) {
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail) throw new ApiError(400, "Thumbnail upload failed");
    await deleteFromCloudinary(video.thumbnail);
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: { title, description, ...(thumbnail && { thumbnail: thumbnail.url }) } },
    { new: true }
  );

  return res.status(200).json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video?.owner.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  await deleteFromCloudinary(video.videoFile, "video");
  await deleteFromCloudinary(video.thumbnail);
  await Video.findByIdAndDelete(videoId);

  return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video?.owner.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  const toggledVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: { isPublished: !video?.isPublished } },
    { new: true }
  );

  return res.status(200).json(new ApiResponse(200, { isPublished: toggledVideo.isPublished }, "Publish status toggled"));
});

export { getAllVideos, publishAVideo, getVideoById, updateVideo, deleteVideo, togglePublishStatus };
