const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: function () {
        return this.isProfileComplete === true;
      },
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
      required: function () {
        return this.isProfileComplete === true;
      },
    },
    role: {
      type: String,
      enum: ['patient', 'family_member'],
      required: true,
      default: 'patient', // Default role is patient
    },
    relation: {
      type: String,
      required: function () {
        return this.role === 'family_member';
      }
    },
    healthStage: {
      type: String,
      enum: ['critical', 'serious', 'stable', 'normal', 'good', 'excellent'],
      required: function () {
        return this.role === 'patient' && this.isProfileComplete === true;
      }
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    // For family members, this will store the associated patient's ID
    associatedPatient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.role === 'family_member';
      }
    },
    // For patients, this will store their family members' IDs
    familyMembers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Store assigned tasks for family members
    assignedTasks: [{
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      task: String,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Store the default family chat ID
    familyChatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
    },
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
module.exports = User;