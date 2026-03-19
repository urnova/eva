/* ═══════════════════════════════════════════════════════════
   EVA V3 - NOTES.JS
   Système de prises de notes
   ═══════════════════════════════════════════════════════════ */

import { db, timestamp } from '../core/firebase-config.js';
import { toast, generateId } from '../core/utils.js';

// ═══ CREATE NOTE ═══
export async function createNote(userId, noteData) {
  try {
    const noteId = generateId('note');
    
    const note = {
      title: noteData.title || 'Nouvelle note',
      content: noteData.content || '',
      tags: noteData.tags || [],
      color: noteData.color || '#0c1220',
      pinned: noteData.pinned || false,
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
    
    await db.collection('users').doc(userId)
      .collection('notes').doc(noteId)
      .set(note);
    
    toast('Note créée', 'success');
    return { success: true, noteId, note };
  } catch (error) {
    console.error('Create note error:', error);
    toast('Erreur création note', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE NOTE ═══
export async function updateNote(userId, noteId, updates) {
  try {
    await db.collection('users').doc(userId)
      .collection('notes').doc(noteId)
      .update({
        ...updates,
        updatedAt: timestamp()
      });
    
    toast('Note sauvegardée', 'success');
    return { success: true };
  } catch (error) {
    console.error('Update note error:', error);
    toast('Erreur sauvegarde', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ DELETE NOTE ═══
export async function deleteNote(userId, noteId) {
  try {
    await db.collection('users').doc(userId)
      .collection('notes').doc(noteId)
      .delete();
    
    toast('Note supprimée', 'success');
    return { success: true };
  } catch (error) {
    console.error('Delete note error:', error);
    toast('Erreur suppression', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ GET NOTES ═══
export async function getNotes(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('notes')
      .orderBy('updatedAt', 'desc')
      .get();
    
    const notes = [];
    snapshot.forEach(doc => {
      notes.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, notes };
  } catch (error) {
    console.error('Get notes error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET NOTE ═══
export async function getNote(userId, noteId) {
  try {
    const doc = await db.collection('users').doc(userId)
      .collection('notes').doc(noteId)
      .get();
    
    if (!doc.exists) {
      return { success: false, error: 'Note not found' };
    }
    
    return { success: true, note: { id: doc.id, ...doc.data() } };
  } catch (error) {
    console.error('Get note error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ SEARCH NOTES ═══
export async function searchNotes(userId, query) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('notes')
      .get();
    
    const queryLower = query.toLowerCase();
    const results = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const titleMatch = data.title?.toLowerCase().includes(queryLower);
      const contentMatch = data.content?.toLowerCase().includes(queryLower);
      const tagsMatch = data.tags?.some(tag => tag.toLowerCase().includes(queryLower));
      
      if (titleMatch || contentMatch || tagsMatch) {
        results.push({ id: doc.id, ...data });
      }
    });
    
    return { success: true, notes: results };
  } catch (error) {
    console.error('Search notes error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET NOTES BY TAG ═══
export async function getNotesByTag(userId, tag) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('notes')
      .where('tags', 'array-contains', tag)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const notes = [];
    snapshot.forEach(doc => {
      notes.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, notes };
  } catch (error) {
    console.error('Get notes by tag error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ PIN NOTE ═══
export async function pinNote(userId, noteId) {
  return await updateNote(userId, noteId, { pinned: true });
}

// ═══ UNPIN NOTE ═══
export async function unpinNote(userId, noteId) {
  return await updateNote(userId, noteId, { pinned: false });
}

// ═══ ADD TAG ═══
export async function addTag(userId, noteId, tag) {
  try {
    await db.collection('users').doc(userId)
      .collection('notes').doc(noteId)
      .update({
        tags: db.firestore.FieldValue.arrayUnion(tag),
        updatedAt: timestamp()
      });
    
    return { success: true };
  } catch (error) {
    console.error('Add tag error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ REMOVE TAG ═══
export async function removeTag(userId, noteId, tag) {
  try {
    await db.collection('users').doc(userId)
      .collection('notes').doc(noteId)
      .update({
        tags: db.firestore.FieldValue.arrayRemove(tag),
        updatedAt: timestamp()
      });
    
    return { success: true };
  } catch (error) {
    console.error('Remove tag error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET ALL TAGS ═══
export async function getAllTags(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('notes')
      .get();
    
    const tagsSet = new Set();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.tags) {
        data.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    
    return { success: true, tags: Array.from(tagsSet).sort() };
  } catch (error) {
    console.error('Get all tags error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  createNote,
  updateNote,
  deleteNote,
  getNotes,
  getNote,
  searchNotes,
  getNotesByTag,
  pinNote,
  unpinNote,
  addTag,
  removeTag,
  getAllTags
};
