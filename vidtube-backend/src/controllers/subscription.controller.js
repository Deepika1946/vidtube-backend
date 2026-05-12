import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channelId");

  const isSubscribed = await Subscription.findOne({ subscriber: req.user?._id, channel: channelId });

  if (isSubscribed) {
    await Subscription.findByIdAndDelete(isSubscribed?._id);
    return res.status(200).json(new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully"));
  }

  await Subscription.create({ subscriber: req.user?._id, channel: channelId });
  return res.status(200).json(new ApiResponse(200, { subscribed: true }, "Subscribed successfully"));
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channelId");

  const subscribers = await Subscription.aggregate([
    { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribedToSubscriber",
            },
          },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribedToSubscriber" },
              isSubscribed: {
                $cond: { if: { $in: [channelId, "$subscribedToSubscriber.subscriber"] }, then: true, else: false },
              },
            },
          },
          { $project: { username: 1, fullName: 1, avatar: 1, subscribersCount: 1, isSubscribed: 1 } },
        ],
      },
    },
    { $unwind: "$subscriber" },
    { $project: { subscriber: 1, _id: 0 } },
  ]);

  return res.status(200).json(new ApiResponse(200, subscribers, "Subscribers fetched successfully"));
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  if (!isValidObjectId(subscriberId)) throw new ApiError(400, "Invalid subscriberId");

  const subscriptions = await Subscription.aggregate([
    { $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) } },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
            },
          },
          { $addFields: { latestVideo: { $last: "$videos" } } },
          { $project: { username: 1, fullName: 1, avatar: 1, latestVideo: 1 } },
        ],
      },
    },
    { $unwind: "$subscribedChannel" },
    { $project: { subscribedChannel: 1, _id: 0 } },
  ]);

  return res.status(200).json(new ApiResponse(200, subscriptions, "Subscribed channels fetched"));
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
