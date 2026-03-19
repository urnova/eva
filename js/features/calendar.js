/* ═══════════════════════════════════════════════════════════
   EVA V3 - CALENDAR.JS
   Système d'agenda/événements
   ═══════════════════════════════════════════════════════════ */

import { db, timestamp } from '../core/firebase-config.js';
import { toast, generateId, formatDateTime } from '../core/utils.js';

// ═══ CREATE EVENT ═══
export async function createEvent(userId, eventData) {
  try {
    const eventId = generateId('event');
    
    const event = {
      title: eventData.title,
      startTime: eventData.startTime, // Date or Timestamp
      endTime: eventData.endTime || null,
      description: eventData.description || '',
      location: eventData.location || '',
      allDay: eventData.allDay || false,
      color: eventData.color || '#00d4ff',
      createdAt: timestamp()
    };
    
    await db.collection('users').doc(userId)
      .collection('events').doc(eventId)
      .set(event);
    
    toast('Événement créé', 'success');
    return { success: true, eventId, event };
  } catch (error) {
    console.error('Create event error:', error);
    toast('Erreur création événement', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE EVENT ═══
export async function updateEvent(userId, eventId, updates) {
  try {
    await db.collection('users').doc(userId)
      .collection('events').doc(eventId)
      .update(updates);
    
    toast('Événement modifié', 'success');
    return { success: true };
  } catch (error) {
    console.error('Update event error:', error);
    toast('Erreur modification', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ DELETE EVENT ═══
export async function deleteEvent(userId, eventId) {
  try {
    await db.collection('users').doc(userId)
      .collection('events').doc(eventId)
      .delete();
    
    toast('Événement supprimé', 'success');
    return { success: true };
  } catch (error) {
    console.error('Delete event error:', error);
    toast('Erreur suppression', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ GET EVENTS ═══
export async function getEvents(userId, startDate, endDate) {
  try {
    let query = db.collection('users').doc(userId)
      .collection('events');
    
    if (startDate) {
      query = query.where('startTime', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('startTime', '<=', endDate);
    }
    
    query = query.orderBy('startTime', 'asc');
    
    const snapshot = await query.get();
    
    const events = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      events.push({
        id: doc.id,
        ...data,
        startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
        endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime ? new Date(data.endTime) : null
      });
    });
    
    return { success: true, events };
  } catch (error) {
    console.error('Get events error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET TODAY'S EVENTS ═══
export async function getTodaysEvents(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await getEvents(userId, today, tomorrow);
}

// ═══ GET THIS WEEK'S EVENTS ═══
export async function getThisWeeksEvents(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  return await getEvents(userId, today, weekFromNow);
}

// ═══ GET THIS MONTH'S EVENTS ═══
export async function getThisMonthsEvents(userId) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  return await getEvents(userId, firstDay, lastDay);
}

// ═══ SEARCH EVENTS ═══
export async function searchEvents(userId, query) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('events')
      .orderBy('startTime', 'desc')
      .limit(100)
      .get();
    
    const queryLower = query.toLowerCase();
    const results = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const titleMatch = data.title?.toLowerCase().includes(queryLower);
      const descMatch = data.description?.toLowerCase().includes(queryLower);
      const locMatch = data.location?.toLowerCase().includes(queryLower);
      
      if (titleMatch || descMatch || locMatch) {
        results.push({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
          endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime ? new Date(data.endTime) : null
        });
      }
    });
    
    return { success: true, events: results };
  } catch (error) {
    console.error('Search events error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  createEvent,
  updateEvent,
  deleteEvent,
  getEvents,
  getTodaysEvents,
  getThisWeeksEvents,
  getThisMonthsEvents,
  searchEvents
};
