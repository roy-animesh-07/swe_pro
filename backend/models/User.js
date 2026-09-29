const mongoose = require('mongoose');

const ROLES = ['REGISTRAR', 'JUDGE', 'LAWYER'];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ROLES },
  },
  { collection: 'users', timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return { username: this.username, name: this.name, role: this.role };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
