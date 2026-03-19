/* ═══════════════════════════════════════════════════════════
   EVA V3 - PROFILE.JS
   Gestion du profil utilisateur
   ═══════════════════════════════════════════════════════════ */

import { getUserProfile, updateUserProfile } from '../core/auth.js';
import { toast } from '../core/utils.js';

// ═══ LOAD PROFILE ═══
export async function loadProfile(userId) {
  const result = await getUserProfile(userId);
  return result;
}

// ═══ UPDATE PROFILE ═══
export async function updateProfile(userId, updates) {
  const result = await updateUserProfile(userId, updates);
  return result;
}

// ═══ UPDATE DISPLAY NAME ═══
export async function updateDisplayName(userId, displayName) {
  return await updateProfile(userId, { displayName });
}

// ═══ UPDATE NICKNAME ═══
export async function updateNickname(userId, nickname) {
  return await updateProfile(userId, { nickname });
}

// ═══ UPDATE PHOTO URL ═══
export async function updatePhotoURL(userId, photoURL) {
  return await updateProfile(userId, { photoURL });
}

// ═══ UPDATE PREFERENCES ═══
export async function updatePreferences(userId, preferences) {
  return await updateProfile(userId, { preferences });
}

// ═══ UPLOAD AVATAR ═══
export async function uploadAvatar(userId, file) {
  // This would upload to Firebase Storage
  // For now, we'll just use a data URL
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const result = await updatePhotoURL(userId, dataUrl);
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read image'));
    };
    
    reader.readAsDataURL(file);
  });
}

export default {
  loadProfile,
  updateProfile,
  updateDisplayName,
  updateNickname,
  updatePhotoURL,
  updatePreferences,
  uploadAvatar
};
