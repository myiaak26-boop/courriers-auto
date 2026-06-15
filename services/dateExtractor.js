const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const MONTHS_FR = [
  null, 'janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'aout', 'septembre', 'octobre', 'novembre', 'décembre', 'decembre'
];

function hasDatePattern(text) {
  if (!text) return false;
  const monthRegex = /janvier|février|fevrier|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|décembre|decembre/i;
  const numericRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
  return monthRegex.test(text) || numericRegex.test(text);
}

function hasDestinatairePattern(text) {
  if (!text) return false;
  return /\badress[ée]e?\s+((?:à|a|au|aux))\b/i.test(text);
}

function extractDateFallback(text) {
  if (!text) return null;
  const months = {
    'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4,
    'mai': 5, 'juin': 6, 'juillet': 7, 'aout': 8, 'août': 8,
    'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12
  };

  const monthPattern = '(janvier|février|fevrier|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|décembre|decembre)';
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Periode type 1: "du X mois1 au Y mois2 année" → prendre X mois1 année
  const periodPattern1 = new RegExp(`du\\s+(\\d{1,2})\\s+${monthPattern}\\s+au\\s+\\d{1,2}\\s+${monthPattern}\\s+(\\d{4})`, 'i');
  let m = t.match(periodPattern1);
  if (m) {
    const monthNum = months[m[2]];
    if (monthNum) return `${m[4]}-${String(monthNum).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  // Periode type 2: "du X au Y mois année" → prendre X mois année (meme mois pour les deux dates)
  const periodPattern2 = new RegExp(`du\\s+(\\d{1,2})\\s+au\\s+\\d{1,2}\\s+${monthPattern}\\s+(\\d{4})`, 'i');
  m = t.match(periodPattern2);
  if (m) {
    const monthNum = months[m[2]];
    if (monthNum) return `${m[3]}-${String(monthNum).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  // Date simple: "19 juin 2026" ou "1er janvier 2026"
  const frPattern = new RegExp(`(\\d{1,2})(?:er)?\\s+${monthPattern}\\s+(\\d{4})`, 'i');
  m = t.match(frPattern);
  if (m) {
    const monthNum = months[m[2]];
    if (monthNum) return `${m[3]}-${String(monthNum).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  // Numerique: "12/06/2026" ou "12-06-2026"
  const numPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  m = t.match(numPattern);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;

  return null;
}

function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function validateDate(dateStr, originalText) {
  if (!dateStr) return null;
  const monthNum = parseInt(dateStr.slice(5, 7), 10);
  const day = parseInt(dateStr.slice(8, 10), 10);
  if (monthNum < 1 || monthNum > 12 || day < 1 || day > 31) return null;

  const monthNamesNFD = [null, 'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const monthName = monthNamesNFD[monthNum];
  if (!monthName) return null;

  const norm = normalizeText(originalText);
  if (!norm.includes(monthName)) return null;
  if (!norm.includes(String(day))) return null;

  return dateStr;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function getUrgencyLevel(days) {
  if (days === null || days === undefined) return 'Normal';
  if (days < 1) return 'Expiré';
  if (days <= 5) return '1';
  if (days <= 10) return '2';
  return 'Normal';
}

async function extractFieldsFromObjetList(objetList, requestedFields = ['urgence', 'destinataire']) {
  const needsDate = requestedFields.includes('urgence');
  const needsDest = requestedFields.includes('destinataire');

  const needsAI = objetList.map(o => {
    if (needsDate && hasDatePattern(o)) return true;
    if (needsDest && hasDestinatairePattern(o)) return true;
    return false;
  });
  const results = objetList.map((o, i) => {
    if (!needsAI[i]) return { date: null, destinataire: null };
    return null;
  });

  const aiIndices = [];
  const aiTexts = [];
  for (let i = 0; i < objetList.length; i++) {
    if (needsAI[i]) {
      aiIndices.push(i);
      aiTexts.push(objetList[i]);
    }
  }

  if (aiTexts.length > 0 && NVIDIA_API_KEY) {
    const aiResults = await callNvidiaForFields(aiTexts, requestedFields);
    for (let j = 0; j < aiIndices.length; j++) {
      const idx = aiIndices[j];
      const ai = aiResults[j] || {};
      const validated = validateDate(ai.date, objetList[idx]);

      if (!validated) {
        const fallback = extractDateFallback(objetList[idx]);
        results[idx] = { date: fallback, destinataire: ai.destinataire || null };
      } else {
        results[idx] = { date: validated, destinataire: ai.destinataire || null };
      }
    }
  }

  for (let i = 0; i < objetList.length; i++) {
    if (!results[i]) {
      const fallback = extractDateFallback(objetList[i]);
      results[i] = { date: fallback, destinataire: null };
    }
  }

  return results;
}

async function callNvidiaForFields(objetList, requestedFields = ['urgence', 'destinataire']) {
  if (!objetList.length || !NVIDIA_API_KEY) {
    return objetList.map(() => ({ date: null, destinataire: null }));
  }

  const needsDate = requestedFields.includes('urgence');
  const needsDest = requestedFields.includes('destinataire');

  const items = objetList.map((o, i) => `${i}. ${o || ''}`);
  const promptText = items.join('\n');

  const instructions = [];
  if (needsDate) {
    instructions.push(`1. "date" : la date de debut de l'evenement ou de la periode au format YYYY-MM-DD.
   - Ex: "19 juin 2026" → "2026-06-19"
   - Ex: "du 23 au 28 juin 2026" → prendre la date de debut → "2026-06-23"
   - Ex: "du 24 aout au 02 septembre 2026" → l'annee 2026 s'applique aux deux dates, prendre le debut → "2026-08-24"
   - ATTENTION : n'invente JAMAIS une date. Si aucune date, mets null.
   - Ne considere PAS une simple annee seule comme une date.`);
  }
  if (needsDest) {
    instructions.push(`2. "destinataire" : le destinataire de la lettre s'il est mentionne apres "adressee a/au/aux".
   - Prefixe toujours par "Copie/"
   - Si contient "adressee a Madame/Monsieur le/la Ministre de X" → "Copie/Ministere de X"
   - Si contient "adressee aux Ordonnateurs du Budget de l'Etat" → "Copie/Ordonnateurs du Budget de l'Etat"
   - Si contient "adressee au Representant autorise de KPS" → "Copie/Representant autorise de KPS"
   - Si aucun destinataire explicite → null (ne pas inventer)`);
  }

  const systemMsg = 'Tu es un assistant specialise dans l\'analyse de courriers administratifs francais. Tu reponds UNIQUEMENT avec un tableau JSON valide, rien d\'autre.';

  const userMsg = `Pour chaque texte ci-dessous, extrais les informations demandees :

${instructions.join('\n')}

Retourne UNIQUEMENT un tableau JSON, ex:
[{"date": "2026-06-19", "destinataire": "Copie/Representant autorise de KPS"}, {"date": null, "destinataire": null}]

Textes :
${promptText}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg }
          ],
          temperature: 0,
          max_tokens: 3000
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`NVIDIA API error (${response.status}):`, errText);
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return objetList.map(() => ({ date: null, destinataire: null }));
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        console.error('No JSON array found in response:', content);
        return objetList.map(() => ({ date: null, destinataire: null }));
      }

      const fields = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(fields)) return objetList.map(() => ({ date: null, destinataire: null }));
      return fields.map(f => ({
        date: f.date || null,
        destinataire: f.destinataire || null
      }));
    } catch (err) {
      console.error('NVIDIA API call failed:', err.message);
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return objetList.map(() => ({ date: null, destinataire: null }));
    }
  }

  return objetList.map(() => ({ date: null, destinataire: null }));
}

async function autoFillFieldsForCourriers(courriers, requestedFields = ['urgence', 'destinataire']) {
  const usage = requestedFields || ['urgence', 'destinataire'];
  const needsUrgence = usage.includes('urgence');
  const needsDestinataire = usage.includes('destinataire');

  if (!needsUrgence && !needsDestinataire) {
    return courriers.map(c => ({ id: c.id, niveau_urgence: null, destinataire: null }));
  }

  const objetList = courriers.map(c => c.objet || '');
  const fields = await extractFieldsFromObjetList(objetList, requestedFields);

  return courriers.map((c, i) => {
    const f = fields[i] || {};
    const days = daysUntil(f.date);
    return {
      id: c.id,
      niveau_urgence: needsUrgence ? getUrgencyLevel(days) : null,
      destinataire: (needsDestinataire && f.destinataire) ? f.destinataire : null,
      extractedDate: f.date,
      days
    };
  });
}

module.exports = { autoFillFieldsForCourriers };
