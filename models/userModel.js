const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: false, // Not required at registration, but for profile completion
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: false, // For profile completion
    },
    stage: {
      type: String,
      required: false, // For profile completion
      enum: ['normal', 'critical', 'stage3', 'stage4', 'stage5'], // Example stages, can be expanded
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    familyMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // To track who added this user, if applicable
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

// Method to match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Middleware to hash password before saving user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;