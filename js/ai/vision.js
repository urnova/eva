/* ═══════════════════════════════════════════════════════════
   EVA V3 - VISION.JS
   Analyse d'images avec GPT-4o ou Moondream
   ═══════════════════════════════════════════════════════════ */

import { toast } from '../core/utils.js';

// ═══ ANALYZE IMAGE WITH GPT-4o ═══
export async function analyzeImageWithGPT4o(imageDataUrl, prompt = "Décris cette image en détail.", apiKey) {
  if (!apiKey) {
    return { success: false, error: 'OpenAI API key required' };
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return {
      success: true,
      description: data.choices[0].message.content,
      model: 'gpt-4o'
    };
  } catch (error) {
    console.error('GPT-4o vision error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ ANALYZE IMAGE WITH PUTER ═══
export async function analyzeImageWithPuter(imageDataUrl, prompt = "Décris cette image.") {
  if (typeof puter === 'undefined') {
    return { success: false, error: 'Puter not loaded' };
  }
  
  try {
    // Convert data URL to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    
    const result = await puter.ai.chat([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: blob }
        ]
      }
    ], {
      model: 'gpt-4o',
      vision: true
    });
    
    return {
      success: true,
      description: result.message.content,
      model: 'gpt-4o (via Puter)'
    };
  } catch (error) {
    console.error('Puter vision error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ ANALYZE IMAGE (Auto provider selection) ═══
export async function analyzeImage(imageDataUrl, options = {}) {
  const prompt = options.prompt || "Décris cette image en détail en français.";
  const provider = options.provider || 'auto';
  
  // Try Puter first if available
  if (provider === 'auto' || provider === 'puter') {
    if (typeof puter !== 'undefined') {
      toast('Analyse de l\'image...', 'info');
      const result = await analyzeImageWithPuter(imageDataUrl, prompt);
      if (result.success) {
        toast('Image analysée !', 'success');
        return result;
      }
    }
  }
  
  // Fallback to GPT-4o if API key available
  if (provider === 'auto' || provider === 'openai') {
    if (options.openaiApiKey) {
      toast('Analyse de l\'image...', 'info');
      const result = await analyzeImageWithGPT4o(imageDataUrl, prompt, options.openaiApiKey);
      if (result.success) {
        toast('Image analysée !', 'success');
        return result;
      }
    }
  }
  
  toast('Aucun provider vision disponible', 'error');
  return { success: false, error: 'No vision provider available' };
}

// ═══ UPLOAD AND ANALYZE ═══
export async function uploadAndAnalyzeImage(file, options = {}) {
  if (!file || !file.type.startsWith('image/')) {
    return { success: false, error: 'Invalid image file' };
  }
  
  try {
    // Convert to data URL
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        const imageDataUrl = e.target.result;
        const result = await analyzeImage(imageDataUrl, options);
        resolve(result);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };
      
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Upload and analyze error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ CHECK VISION SUPPORT ═══
export function checkVisionSupport(config = {}) {
  const hasPuter = typeof puter !== 'undefined';
  const hasOpenAI = !!config.openaiApiKey;
  
  return {
    supported: hasPuter || hasOpenAI,
    providers: {
      puter: hasPuter,
      openai: hasOpenAI
    }
  };
}

export default {
  analyzeImage,
  analyzeImageWithGPT4o,
  analyzeImageWithPuter,
  uploadAndAnalyzeImage,
  checkVisionSupport
};
