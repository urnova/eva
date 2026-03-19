/* ═══════════════════════════════════════════════════════════
   EVA V3 - AUTH.JS
   Gestion complète de l'authentification Firebase
   ═══════════════════════════════════════════════════════════ */

import { auth, db, timestamp } from './firebase-config.js';

// ═══ CHECK AUTH STATE ═══
export function checkAuth(requireAuth = true) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged((user) => {
      if (requireAuth && !user) {
        window.location.href = '/login';
        reject('Not authenticated');
      } else {
        resolve(user);
      }
    });
  });
}

// ═══ SIGN IN WITH EMAIL ═══
export async function signInWithEmail(email, password, rememberMe = false) {
  try {
    if (rememberMe) {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } else {
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    }
    
    const result = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

// ═══ SIGN UP WITH EMAIL ═══
export async function signUpWithEmail(email, password) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await createUserProfile(result.user);
    return { success: true, user: result.user, isNew: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

// ═══ SIGN IN WITH GOOGLE ═══
export async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await auth.signInWithPopup(provider);
    const isNewUser = result.additionalUserInfo?.isNewUser;
    
    if (isNewUser) {
      await createUserProfile(result.user);
    }
    
    return { success: true, user: result.user, isNew: isNewUser };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

// ═══ SIGN OUT ═══
export async function signOut() {
  try {
    await auth.signOut();
    window.location.href = '/';
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erreur lors de la déconnexion' };
  }
}

// ═══ CREATE USER PROFILE ═══
async function createUserProfile(user) {
  try {
    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      await userRef.set({
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || null,
        createdAt: timestamp(),
        role: 'user',
        preferences: {
          aiProvider: 'qwen',
          qwenModel: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
          voiceProvider: 'native',
          voiceLang: 'fr-FR',
          selectedVoice: 'auto',
          speechRate: 1.0,
          speechPitch: 1.0,
          wakeWord: 'eva',
          wakeAutoStart: false
        }
      });
    }
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
}

// ═══ GET USER PROFILE ═══
export async function getUserProfile(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      return { success: true, data: doc.data() };
    } else {
      return { success: false, error: 'Profile not found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE USER PROFILE ═══
export async function updateUserProfile(uid, data) {
  try {
    await db.collection('users').doc(uid).update({
      ...data,
      updatedAt: timestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═══ ERROR MESSAGES ═══
function getAuthErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé',
    'auth/invalid-email': 'Email invalide',
    'auth/weak-password': 'Mot de passe trop faible (min 6 caractères)',
    'auth/user-not-found': 'Aucun compte trouvé avec cet email',
    'auth/wrong-password': 'Mot de passe incorrect',
    'auth/popup-closed-by-user': 'Popup fermée. Réessayez.',
    'auth/popup-blocked': 'Popup bloquée. Autorisez les popups.',
    'auth/cancelled-popup-request': 'Une autre popup est déjà ouverte',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.'
  };
  
  return messages[error.code] || `Erreur: ${error.message}`;
}

// ═══ CHECK IF USER HAS COMPLETED ONBOARDING ═══
export async function hasCompletedOnboarding(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      return !!data.nickname && !!data.onboardingCompleted;
    }
    return false;
  } catch (error) {
    console.error('Error checking onboarding:', error);
    return false;
  }
}

// ═══ GET CURRENT USER ═══
export function getCurrentUser() {
  return auth.currentUser;
}

// ═══ UPDATE PASSWORD ═══
export async function updatePassword(newPassword) {
  try {
    const user = auth.currentUser;
    await user.updatePassword(newPassword);
    return { success: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

// ═══ SEND PASSWORD RESET EMAIL ═══
export async function sendPasswordResetEmail(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

// ═══ DELETE ACCOUNT ═══
export async function deleteAccount(uid) {
  try {
    // Delete user data from Firestore
    await db.collection('users').doc(uid).delete();
    
    // Delete conversations
    const conversations = await db.collection('users').doc(uid)
      .collection('conversations').get();
    
    const batch = db.batch();
    conversations.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    // Delete Firebase Auth account
    await auth.currentUser.delete();
    
    window.location.href = '/';
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erreur lors de la suppression du compte' };
  }
}

export default {
  checkAuth,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
  getUserProfile,
  updateUserProfile,
  hasCompletedOnboarding,
  getCurrentUser,
  updatePassword,
  sendPasswordResetEmail,
  deleteAccount
};
