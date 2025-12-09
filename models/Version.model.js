import mongoose from "mongoose";

const appVersionSchema = new mongoose.Schema(
  {
    ios_storeVersion: { type: String, required: true },
    android_storeVersion: { type: String, required: true },
    ios_storeLink: { type: String },
    android_storeLink: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("AppVersion", appVersionSchema);
