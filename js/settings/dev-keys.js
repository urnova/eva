/* ═══════════════════════════════════════════════════════════
   EVA V3 - DEV-KEYS.JS
   Activation clés développeur
   ═══════════════════════════════════════════════════════════ */

import { db } from '../core/firebase-config.js';
import { updateUserProfile } from '../core/auth.js';
import { toast } from '../core/utils.js';
import { USER_ROLES } from '../core/config.js';

// ═══ VALIDATE DEV KEY ═══
export async function validateDevKey(key) {
  try {
    const snapshot = await db.collection('dev_keys_valid')
      .where('key', '==', key)
      .where('active', '==', true)
      .get();
    
    if (snapshot.empty) {
      return { success: false, error: 'Clé invalide ou inactive' };
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      success: true,
      keyData: {
        role: data.role,
        label: data.label
      }
    };
  } catch (error) {
    console.error('Validate dev key error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ ACTIVATE DEV KEY ═══
export async function activateDevKey(userId, key) {
  try {
    // Validate key
    const validation = await validateDevKey(key);
    
    if (!validation.success) {
      toast(validation.error, 'error');
      return validation;
    }
    
    const { role, label } = validation.keyData;
    
    // Update user role
    const result = await updateUserProfile(userId, {
      role,
      devKey: key,
      devKeyLabel: label
    });
    
    if (result.success) {
      const roleInfo = USER_ROLES[role];
      toast(`Clé activée : ${roleInfo?.label || role}`, 'success');
      
      // Reload page to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
    
    return result;
  } catch (error) {
    console.error('Activate dev key error:', error);
    toast('Erreur activation clé', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ DEACTIVATE DEV KEY ═══
export async function deactivateDevKey(userId) {
  try {
    const result = await updateUserProfile(userId, {
      role: 'user',
      devKey: null,
      devKeyLabel: null
    });
    
    if (result.success) {
      toast('Clé désactivée', 'success');
      
      // Reload page
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
    
    return result;
  } catch (error) {
    console.error('Deactivate dev key error:', error);
    toast('Erreur désactivation', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ CHECK USER ROLE ═══
export function checkUserRole(user, requiredRole) {
  if (!user || !user.role) return false;
  
  const rolePriority = {
    user: 0,
    developer: 1,
    creator_wife: 2,
    creator: 3
  };
  
  const userPriority = rolePriority[user.role] || 0;
  const requiredPriority = rolePriority[requiredRole] || 0;
  
  return userPriority >= requiredPriority;
}

// ═══ GET ROLE BADGE ═══
export function getRoleBadge(role) {
  const roleInfo = USER_ROLES[role];
  if (!roleInfo) return null;
  
  return {
    text: roleInfo.badge,
    color: roleInfo.badgeColor,
    canSeeReports: roleInfo.canSeeReports,
    canAccessAdmin: roleInfo.canAccessAdmin
  };
}

export default {
  validateDevKey,
  activateDevKey,
  deactivateDevKey,
  checkUserRole,
  getRoleBadge
};
