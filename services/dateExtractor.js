const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

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

async function extractFieldsFromObjetList(objetList) {
  if (!NVIDIA_API_KEY) {
    console.warn('NVIDIA_API_KEY not set, skipping AI extraction');
    return objetList.map(() => ({ date: null, destinataire: null }));
  }

  const items = objetList.map((o, i) => `${i}. ${o || ''}`);
  const promptText = items.join('\n');

  const systemMsg = 'Tu es un assistant specialise dans l\'analyse de courriers administratifs francais. Tu reponds UNIQUEMENT avec un tableau JSON valide, rien d\'autre.';

  const userMsg = `Pour chaque texte ci-dessous, extrais deux informations :

1. "date" : la date de debut de l'evenement ou de la periode au format YYYY-MM-DD.
   - Ex: "19 juin 2026" → "2026-06-19"
   - Ex: "du 23 au 28 juin 2026" → prendre la date de debut → "2026-06-23"
   - Ne considere PAS une simple annee seule (ex: "2026", "plan 2025") comme une date.
   - Si aucune date valide → null

2. "destinataire" : le destinataire de la lettre s'il est mentionne apres "adressee a/au/aux".
   - Prefixe toujours par "Copie/"
   - Si contient "adressee a Madame/Monsieur le/la Ministre de X" → "Copie/Ministere de X"
   - Si contient "adressee aux Ordonnateurs du Budget de l'Etat" → "Copie/Ordonnateurs du Budget de l'Etat"
   - Si contient "adressee au Representant autorise de KPS" → "Copie/Representant autorise de KPS"
   - Si aucun destinataire explicite → null (ne pas inventer)

Retourne UNIQUEMENT un tableau JSON valide, ex:
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

async function autoFillFieldsForCourriers(courriers) {
  const objetList = courriers.map(c => c.objet || '');
  const fields = await extractFieldsFromObjetList(objetList);

  return courriers.map((c, i) => {
    const f = fields[i] || {};
    const days = daysUntil(f.date);
    return {
      id: c.id,
      niveau_urgence: getUrgencyLevel(days),
      destinataire: f.destinataire || null,
      extractedDate: f.date,
      days
    };
  });
}

module.exports = { autoFillFieldsForCourriers };
