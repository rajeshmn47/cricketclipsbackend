import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    videos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Clip",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // -------- Existing field (kept for compatibility) --------
    isPublic: {
      type: Boolean,
      default: true,   // true = public, false = private
    },
    // -------- New fields for granular visibility & collaboration --------
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: function() {
        // Map existing isPublic to visibility for old playlists
        return this.isPublic ? "public" : "private";
      }
    },
    isCollaborative: {
      type: Boolean,
      default: false,
    },
    collaborators: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["editor", "viewer"], default: "editor" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    // -------- Optional enhancements (you may add later) --------
    coverImage: { type: String },               // thumbnail URL
    likesCount: { type: Number, default: 0 },   // popularity for public playlists
    tags: [
      {
        type: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre‑save middleware to keep isPublic & visibility in sync
playlistSchema.pre("save", function(next) {
  // When saving, also set isPublic based on visibility (optional, but ensures compatibility)
  if (this.visibility === "public") this.isPublic = true;
  else if (this.visibility === "private" || this.visibility === "unlisted") this.isPublic = false;
  next();
});

export default mongoose.model("Playlist", playlistSchema);