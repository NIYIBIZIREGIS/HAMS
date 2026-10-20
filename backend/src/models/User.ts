import { Schema, model, Document, Types } from 'mongoose';

export type UserRole =
  | 'super_admin'
  | 'facility_admin'
  /** Alias of `facility_admin`, kept for the terminology used in the specification. */
  | 'hospital_admin'
  | 'receptionist'
  | 'doctor'
  | 'nurse'
  | 'lab_technician'
  | 'pharmacist'
  | 'insurance_verifier'
  | 'auditor'
  | 'patient';

export interface IUser extends Document {
  fullName: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  passwordHash: string;
  role: UserRole;
  facilityId?: Types.ObjectId;
  status: 'active' | 'inactive' | 'suspended';
  /**
   * Status this account held before its hospital was deleted. Restoring the hospital
   * puts the account back exactly as it was, instead of blanket-reactivating staff who
   * had been suspended on purpose beforehand.
   */
  preFacilitySuspensionStatus?: 'active' | 'inactive' | 'suspended' | null;
  preferredLanguage: string;
  profileImageUrl?: string;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  /**
   * Set when an account is issued a one-time password by the platform owner. The account
   * can sign in but must choose a private password before doing anything else.
   */
  mustChangePassword?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, unique: true, sparse: true, trim: true },
    nationalId: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: [
        'super_admin',
        'facility_admin',
        'hospital_admin',
        'receptionist',
        'doctor',
        'nurse',
        'lab_technician',
        'pharmacist',
        'insurance_verifier',
        'auditor',
        'patient',
      ],
      required: true,
    },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', default: null },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    preFacilitySuspensionStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended', null],
      default: null,
    },
    preferredLanguage: { type: String, default: 'en' },
    profileImageUrl: { type: String, default: '' },
    emailVerifiedAt: { type: Date, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ facilityId: 1, role: 1 });
userSchema.index({ role: 1 });

// Store one canonical spelling for aliased roles so queries and uniqueness checks agree.
userSchema.pre('validate', function normaliseRoleAlias(next) {
  const alias: Record<string, string> = { hospital_admin: 'facility_admin' };
  if (this.role && alias[this.role]) {
    this.role = alias[this.role] as UserRole;
  }
  next();
});

export const User = model<IUser>('Users', userSchema);
