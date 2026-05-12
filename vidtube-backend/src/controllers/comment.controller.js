import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const commentsAggregate = Comment.aggregate([
    { $match: { video: new mongoose.Types.ObjectId(videoId) } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        owner: { $first: "$owner" },
        isLiked: { $cond: { if: { $in: [req.user?._id, "$likes.likedBy"] }, then: true, else: false } },
      },
    },
    { $sort: { createdAt: -1 } },
    { $project: { content: 1, createdAt: 1, likesCount: 1, owner: { username: 1, fullName: 1, avatar: 1 }, isLiked: 1 } },
  ]);

  const options = { page: parseInt(page), limit: parseInt(limit) };
  const comments = await Comment.aggregatePaginate(commentsAggregate, options);

  return res.status(200).json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");
  if (!content) throw new ApiError(400, "Content is required");

  const comment = await Comment.create({ content, video: videoId, owner: req.user?._id });
  if (!comment) throw new ApiError(500, "Failed to add comment");

  return res.status(201).json(new ApiResponse(200, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment ID");
  if (!content) throw new ApiError(400, "Content is required");

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");
  if (comment.owner.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  const updated = await Comment.findByIdAndUpdate(commentId, { $set: { content } }, { new: true });
  return res.status(200).json(new ApiResponse(200, updated, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment ID");

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");
  if (comment.owner.toString() !== req.user?._id.toString()) throw new ApiError(403, "Unauthorized");

  await Comment.findByIdAndDelete(commentId);
  return res.status(200).json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
