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
  if (days < 1) return 'Normal';
  if (days <= 5) return '1';
  if (days <= 10) return '2';
  return 'Normal';
}

async function extractDatesFromObjetList(objetList) {
  if (!NVIDIA_API_KEY) {
    console.warn('NVIDIA_API_KEY not set, skipping AI date extraction');
    return objetList.map(() => null);
  }

  const items = objetList.map((o, i) => `${i}. ${o || ''}`);
  const promptText = items.join('\n');

  const systemMsg = 'Tu es un extracteur de dates en français. Tu réponds UNIQUEMENT avec un tableau JSON valide, rien d\'autre.';
  const userMsg = `Pour chaque texte ci-dessous, extrais la date de début d'événement ou de période au format YYYY-MM-DD. Si une période (ex: "du 23 au 28 juin 2026"), prends la date de début (23 juin 2026 → 2026-06-23). Si aucune date, mets null. Retourne UNIQUEMENT un tableau JSON valide, ex: ["2026-06-19", null, "2026-06-23"]:

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
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`NVIDIA API error (${response.status}):`, errText);
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return objetList.map(() => null);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        console.error('No JSON array found in response:', content);
        return objetList.map(() => null);
      }

      const dates = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(dates)) return objetList.map(() => null);
      return dates;
    } catch (err) {
      console.error('NVIDIA API call failed:', err.message);
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return objetList.map(() => null);
    }
  }

  return objetList.map(() => null);
}

async function autoFillUrgencyForCourriers(courriers) {
  const objetList = courriers.map(c => c.objet || '');
  const dates = await extractDatesFromObjetList(objetList);

  return courriers.map((c, i) => {
    const days = daysUntil(dates[i]);
    return {
      id: c.id,
      niveau_urgence: getUrgencyLevel(days),
      extractedDate: dates[i],
      days
    };
  });
}

module.exports = { autoFillUrgencyForCourriers };
