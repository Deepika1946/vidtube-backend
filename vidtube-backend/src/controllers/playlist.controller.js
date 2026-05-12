import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.models.js";
import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) throw new ApiError(400, "Name and description are required");

  const playlist = await Playlist.create({ name, description, owner: req.user?._id });
  if (!playlist) throw new ApiError(500, "Failed to create playlist");

  return res.status(201).json(new ApiResponse(200, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");

  const playlists = await Playlist.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $addFields: {
        totalVideos: { $size: "$videos" },
        totalViews: { $sum: "$videos.views" },
      },
    },
    { $project: { name: 1, description: 1, totalVideos: 1, totalViews: 1, updatedAt: 1 } },
  ]);

  return res.status(200).json(new ApiResponse(200, playlists, "User playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist ID");

  const playlist = await Playlist.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          { $match: { isPublished: true } },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
            },
          },
          { $addFields: { owner: { $first: "$owner" } } },
          { $project: { title: 1, thumbnail: 1, duration: 1, views: 1, owner: { username: 1, fullName: 1, avatar: 1 } } },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        totalVideos: { $size: "$videos" },
        totalViews: { $sum: "$videos.views" },
        owner: { $first: "$owner" },
      },
    },
    { $project: { name: 1, description: 1, createdAt: 1, updatedAt: 1, totalVideos: 1, totalViews: 1, videos: 1, owner: { username: 1, fullName: 1, avatar: 1 } } },
  ]);

  if (!playlist?.length) throw new ApiError(404, "Playlist not found");
  return res.status(200).json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) throw new ApiError(400, "Invalid IDs");

  const playlist = await Playlist.findById(playlistId);
  const video = await Video.findById(videoId);
  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (!video) throw new ApiError(404, "Video not found");
  if (playlist.owner?.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  const updated = await Playlist.findByIdAndUpdate(
    playlistId,
    { $addToSet: { videos: videoId } },
    { new: true }
  );
  return res.status(200).json(new ApiResponse(200, updated, "Video added to playlist"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) throw new ApiError(400, "Invalid IDs");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner?.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  const updated = await Playlist.findByIdAndUpdate(
    playlistId,
    { $pull: { videos: videoId } },
    { new: true }
  );
  return res.status(200).json(new ApiResponse(200, updated, "Video removed from playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist ID");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner?.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  await Playlist.findByIdAndDelete(playlistId);
  return res.status(200).json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist ID");
  if (!name || !description) throw new ApiError(400, "Name and description are required");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner?.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  const updated = await Playlist.findByIdAndUpdate(playlistId, { $set: { name, description } }, { new: true });
  return res.status(200).json(new ApiResponse(200, updated, "Playlist updated successfully"));
});

export { createPlaylist, getUserPlaylists, getPlaylistById, addVideoToPlaylist, removeVideoFromPlaylist, deletePlaylist, updatePlaylist };
