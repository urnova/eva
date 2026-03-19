/* ═══════════════════════════════════════════════════════════
   EVA V3 - REPORTS.JS
   Système de rapports bugs/feedback
   ═══════════════════════════════════════════════════════════ */

import { db, timestamp } from '../core/firebase-config.js';
import { toast, getSystemInfo } from '../core/utils.js';
import { getContext } from '../ai/chat-handler.js';

// ═══ SUBMIT REPORT ═══
export async function submitReport(userId, reportData) {
  try {
    const report = {
      userId,
      userEmail: reportData.userEmail || '',
      type: reportData.type || 'bug', // 'bug' or 'feedback'
      title: reportData.title,
      message: reportData.message,
      systemInfo: getSystemInfo(),
      conversationContext: reportData.includeContext ? getConversationContext() : null,
      status: 'open',
      createdAt: timestamp()
    };
    
    const docRef = await db.collection('reports').add(report);
    
    toast('Rapport envoyé ! Merci.', 'success');
    return { success: true, reportId: docRef.id };
  } catch (error) {
    console.error('Submit report error:', error);
    toast('Erreur lors de l\'envoi', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ GET CONVERSATION CONTEXT ═══
function getConversationContext() {
  try {
    const context = getContext();
    
    if (!context || context.length === 0) {
      return null;
    }
    
    // Get last 5 messages
    const recentMessages = context.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content.substring(0, 200) // Truncate to 200 chars
    }));
    
    return {
      messageCount: context.length,
      recentMessages
    };
  } catch (error) {
    console.error('Get conversation context error:', error);
    return null;
  }
}

// ═══ GET USER REPORTS ═══
export async function getUserReports(userId) {
  try {
    const snapshot = await db.collection('reports')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const reports = [];
    snapshot.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, reports };
  } catch (error) {
    console.error('Get user reports error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET ALL REPORTS (Admin only) ═══
export async function getAllReports(status = null) {
  try {
    let query = db.collection('reports').orderBy('createdAt', 'desc');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.limit(100).get();
    
    const reports = [];
    snapshot.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, reports };
  } catch (error) {
    console.error('Get all reports error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE REPORT STATUS ═══
export async function updateReportStatus(reportId, status) {
  try {
    await db.collection('reports').doc(reportId).update({
      status,
      updatedAt: timestamp()
    });
    
    toast('Statut mis à jour', 'success');
    return { success: true };
  } catch (error) {
    console.error('Update report status error:', error);
    toast('Erreur mise à jour', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ ADD COMMENT TO REPORT ═══
export async function addReportComment(reportId, comment, userId) {
  try {
    await db.collection('reports').doc(reportId).update({
      comments: db.firestore.FieldValue.arrayUnion({
        userId,
        comment,
        timestamp: new Date().toISOString()
      }),
      updatedAt: timestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Add report comment error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ DELETE REPORT ═══
export async function deleteReport(reportId) {
  try {
    await db.collection('reports').doc(reportId).delete();
    
    toast('Rapport supprimé', 'success');
    return { success: true };
  } catch (error) {
    console.error('Delete report error:', error);
    toast('Erreur suppression', 'error');
    return { success: false, error: error.message };
  }
}

export default {
  submitReport,
  getUserReports,
  getAllReports,
  updateReportStatus,
  addReportComment,
  deleteReport
};
