import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  Upload,
  KeyRound,
  User,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  Briefcase,
  Phone,
  Building,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../api.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'password';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile'
}) => {
  const { user, refreshProfile, updateUserAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab);

  // Profile State
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(user?.avatarUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process image file to base64 with canvas resizing
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setProfileErrorMsg('Please select a valid image file (PNG, JPEG, WebP, etc.)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setProfileErrorMsg('Image is too large. Please choose an image smaller than 8MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setProfileErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize down to max 400x400 for super snappy performance
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setPreviewAvatar(dataUrl);
          setIsUploadingPhoto(false);
        } else {
          setPreviewAvatar(event.target?.result as string);
          setIsUploadingPhoto(false);
        }
      };
      img.onerror = () => {
        setIsUploadingPhoto(false);
        setProfileErrorMsg('Could not read image file.');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
      setProfileErrorMsg('Could not process selected image.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      if (previewAvatar && previewAvatar !== user?.avatarUrl) {
        await updateUserAvatar(previewAvatar);
      }

      await api.updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        avatarUrl: previewAvatar || undefined
      });

      await refreshProfile();
      setProfileSuccessMsg('Your profile and avatar picture have been updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to update profile information.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (!currentPassword) {
      setPasswordErrorMsg('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirm password do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword({
        currentPassword,
        newPassword
      });

      setPasswordSuccessMsg('Password changed successfully! Keep your credentials safe.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 5000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = () => {
    const first = firstName || user?.firstName || 'M';
    const last = lastName || user?.lastName || 'C';
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with vibrant colorful gradient banner */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Account & Security Settings
              </h2>
              <p className="text-xs text-indigo-100 mt-0.5">
                Manage your teammate profile picture, details, and login credentials
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile & Picture</span>
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Change Password</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: PROFILE & PICTURE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {profileSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}
              {profileErrorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              {/* Profile Photo Uploader */}
              <div className="bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center gap-5">
                {/* Avatar Preview */}
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  title="Click or drag an image here to upload your profile picture"
                >
                  <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-white shadow-lg border border-indigo-200 flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-2xl">
                    {previewAvatar ? (
                      <img
                        src={previewAvatar}
                        alt="Profile avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{getInitials()}</span>
                    )}
                  </div>

                  {/* Hover Camera Overlay */}
                  <div className="absolute inset-0 rounded-2xl bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Change</span>
                  </div>

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 rounded-2xl bg-slate-900/70 flex items-center justify-center text-white">
                      <RefreshCw className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Teammate Profile Picture
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      Live Photo
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload your picture to personalize your account across tasks, projects, and workforce directory.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select Photo</span>
                    </button>
                    {previewAvatar && (
                      <button
                        type="button"
                        onClick={() => setPreviewAvatar(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Supports JPG, PNG, WebP up to 8MB. Auto-optimized.
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    placeholder="Enter first name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    placeholder="Enter last name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Job Title / Role Display
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                      placeholder="e.g. Lead Engineer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Contact Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                      placeholder="+49 30 555-0100"
                    />
                  </div>
                </div>
              </div>

              {/* Readonly Account Details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Organization Credentials
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-bold text-indigo-700">{user?.role}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{user?.departmentName || 'Enterprise Operations'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Profile & Photo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-5">
              {passwordSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}
              {passwordErrorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Security Tip:</span> Choose a password with at least 6 characters. For enterprise safety, avoid reusing personal passwords.
                </div>
              </div>

              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    placeholder="Enter your current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    placeholder="Minimum 6 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength Meter Indicator */}
                {newPassword && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          newPassword.length < 6
                            ? 'w-1/4 bg-rose-500'
                            : newPassword.length < 10
                            ? 'w-2/4 bg-amber-500'
                            : 'w-full bg-emerald-500'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      {newPassword.length < 6
                        ? 'Too short'
                        : newPassword.length < 10
                        ? 'Moderate'
                        : 'Strong password'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    placeholder="Repeat new password"
                    required
                  />
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                    Passwords do not match.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
