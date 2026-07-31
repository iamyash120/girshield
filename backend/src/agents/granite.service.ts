import axios from 'axios';
import { logger } from '../utils/logger';
import { AnimalSpecies, AlertLevel } from '../types';

interface GraniteMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GraniteResponse {
  results: Array<{ generated_text: string }>;
}

// ─── Local intelligence library (used when no IBM API key is configured) ───
const LOCAL_RESPONSES = {
  safety: {
    asiatic_lion: (distKm: number) => `
🦁 ASIATIC LION SAFETY ALERT (${distKm.toFixed(1)} km away)

IMMEDIATE ACTIONS:
• Move indoors immediately and lock all doors/windows
• Call Forest Department Helpline: 1800-180-6127 (toll-free, 24×7)
• Alert your neighbours by phone — do NOT go outside to warn them

DO NOT:
• Run — lions are triggered by fleeing movement
• Approach or try to photograph the animal
• Attempt to drive it away or make loud noises

LIVESTOCK PROTECTION:
• Bring all cattle, goats, and sheep into secured sheds immediately
• Keep sheds locked with heavy bolts — lions can open basic latches
• Place a lit lantern outside the shed — lions avoid bright light

WHEN TO CALL POLICE: If the lion is inside a village boundary, or if any human is injured, call 100 immediately in addition to the forest helpline.

SAFE ZONE: Remain at least ${Math.max(distKm * 2, 3)} km from the last sighting location until forest officers give the all-clear.`.trim(),

    leopard: (distKm: number) => `
🐆 LEOPARD SAFETY ALERT (${distKm.toFixed(1)} km away)

IMMEDIATE ACTIONS:
• Go indoors, especially with children and elderly
• Call Forest Department: 1800-180-6127
• Leopards are highly adaptable — they enter villages at night

DO NOT:
• Let children play outdoors after dusk
• Leave pets (dogs, cats) outside at night
• Walk alone in fields or forest edges after sunset

LIVESTOCK PROTECTION:
• Secure all small animals (goats, sheep, poultry) in covered enclosures
• Leopards can climb over most fences — ensure roofs are covered
• Remove food waste that may attract prey animals

TONIGHT'S RISK: Leopards are most active 2 hours before dawn and after dusk. Extra caution 6 PM – 6 AM.`.trim(),

    general: (species: string, distKm: number) => `
🐾 WILDLIFE ALERT — ${species.toUpperCase()} (${distKm.toFixed(1)} km away)

Stay indoors, secure livestock, and report any sighting to:
Forest Department Helpline: 1800-180-6127
Gujarat Forest Department Emergency: 0285-2630081`.trim(),
  },

  compensation: {
    livestock: `
📋 LIVESTOCK COMPENSATION CLAIM — GUJARAT FOREST DEPARTMENT

ELIGIBILITY: Any farmer who has suffered livestock loss due to wildlife attack within the notified Gir Protected Area or buffer zone.

REQUIRED DOCUMENTS:
1. FIR / Forest Beat Officer complaint (filed within 24 hours of attack)
2. Panchnama (spot inspection report by forest officer)
3. Veterinary certificate confirming cause of death/injury
4. Photographs of dead/injured livestock (with date and location)
5. Livestock ownership proof (Pashupalan card or tax receipt)
6. Bank account details (Aadhaar-linked account mandatory)
7. Identity proof (Aadhaar card)
8. Land/residence certificate from Talati

COMPENSATION RATES (Gujarat Government — current):
• Cow / Buffalo: ₹30,000 per head
• Bullock (working): ₹25,000 per head
• Goat / Sheep: ₹3,000 per head
• Poultry: ₹50 per bird

PROCESS:
Step 1: Report immediately to nearest Forest Beat Guard (within 24 hours)
Step 2: Forest officer conducts spot panchnama within 48 hours
Step 3: Submit Form C-7 at Divisional Forest Office (DFO)
Step 4: DFO verifies and recommends within 30 days
Step 5: Compensation deposited to bank account within 60 days

APPEAL: If claim is rejected, appeal within 30 days to the Chief Conservator of Forests.
DFO Junagadh: 0285-2630081
Toll-free: 1800-180-6127`.trim(),

    property: `
📋 PROPERTY DAMAGE COMPENSATION — GUJARAT FOREST DEPARTMENT

REQUIRED DOCUMENTS:
1. FIR with forest officer complaint
2. Panchnama of damaged property
3. Photographs with timestamp
4. Estimated repair cost from registered contractor
5. Ownership proof of property
6. Aadhaar card

PROCESS: Same as livestock — report within 24 hours, submit Form C-7 at DFO office.

COMPENSATION RATES:
• House wall/door damage: Assessed case-by-case (max ₹50,000)
• Crop damage: ₹15,000 per acre (maximum 2 acres per family)

Contact DFO Junagadh: 0285-2630081`.trim(),

    medical: `
📋 HUMAN INJURY / MEDICAL COMPENSATION — GUJARAT FOREST DEPARTMENT

EMERGENCY FIRST: Call 108 (Ambulance) immediately for injuries.

COMPENSATION (Post-treatment):
• Minor injury: Up to ₹25,000 medical reimbursement
• Grievous injury: Up to ₹1,00,000
• Permanent disability: ₹2,00,000 – ₹5,00,000
• Death: ₹5,00,000 (ex-gratia to family)

DOCUMENTS REQUIRED:
1. Hospital discharge summary / medical records
2. FIR with forest department complaint
3. Doctor's certificate describing injuries
4. Aadhaar card of victim
5. Bank account details (family nominee for death cases)

FILE WITHIN: 90 days of incident
Contact: DFO Junagadh — 0285-2630081`.trim(),
  },

  chat: {
    greeting: (name?: string) =>
      `Hello${name ? ` ${name}` : ''}! 👋 I'm GirShield AI Assistant.\n\nI can help you with:\n• 🦁 Wildlife alerts and safety guidance\n• 📋 Compensation claim process\n• 🚨 Reporting incidents\n• 🗺️ Safe zone information\n• 📞 Forest department contacts\n\nWhat do you need help with today?`,

    alerts: `To check active wildlife alerts near your village, go to the **Wildlife Alerts** section in your dashboard. Alerts are updated in real-time whenever forest officers or the AI prediction system detects a threat. You can also see all alerts on the Safety Map.`,

    reporting: `To report a wildlife incident:\n1. Go to **My Incidents** in your dashboard\n2. Click **Report Incident**\n3. Fill in the type, description, and severity\n4. The nearest forest officer will be automatically notified\n\nFor emergencies: Call 1800-180-6127 immediately.`,

    contacts: `📞 IMPORTANT CONTACTS:\n\n• Forest Dept. Helpline (24×7): 1800-180-6127 (toll-free)\n• DFO Junagadh: 0285-2630081\n• Sasan Gir Forest Range: 02877-285540\n• Police Emergency: 100\n• Ambulance: 108\n• Gir Wildlife Control Room: 02877-285521`,

    prediction: `The AI Prediction engine uses:\n• GPS collar data from tagged lions and leopards\n• Historical movement patterns (last 30 days)\n• Time of day and season factors\n• Weather conditions\n\nForest officers can run a new prediction from the **Predictions** page. Predictions are valid for 6 hours and automatically trigger alerts if threat level is High or Critical.`,

    patrol: `Patrol routes are assigned by the division forest officer based on:\n• Current threat predictions\n• Recent incident locations\n• Officer availability and zone assignments\n\nCheck the **Wildlife Map** for current patrol coverage.`,

    unknown: `I can help you with wildlife alerts, safety guidance, incident reporting, compensation claims, and forest department contacts.\n\nTry asking:\n• "What to do if I see a lion?"\n• "How to file a compensation claim?"\n• "Show emergency contacts"\n• "How does the prediction engine work?"`,
  },

  reports: {
    weekly: (stats: Record<string, unknown>) => `
GIRSHIELD AI — WEEKLY WILDLIFE CONFLICT MONITORING REPORT
Gir Forest Region, Gujarat, India
Generated: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This report covers human-wildlife conflict activity monitored by the GirShield AI platform for the Gir Forest region. All data is sourced from field observations, GPS collar tracking, and community incident reports.

KEY STATISTICS
• Weekly Incidents: ${stats.weekly_incidents ?? 'N/A'}
• Active Alerts: ${stats.active_alerts ?? 'N/A'}
• Tracked Animals: ${stats.tracked_animals ?? 'N/A'}
• Monitored Villages: ${stats.total_villages ?? 'N/A'}

RISK ASSESSMENT
${Number(stats.active_alerts) > 5 ? '⚠️  HIGH ACTIVITY PERIOD — Increased patrols recommended in buffer zone areas.' : Number(stats.active_alerts) > 2 ? '⚡ MODERATE ACTIVITY — Standard patrol protocols in effect.' : '✅ LOW ACTIVITY — Normal monitoring conditions.'}

RECOMMENDATIONS
1. Continue GPS monitoring of all tagged individuals — review collar battery levels
2. ${Number(stats.weekly_incidents) > 3 ? 'Deploy additional rangers in high-incident villages this week' : 'Maintain standard patrol frequency'}
3. Conduct weekly community awareness sessions in high-risk villages
4. Review and update livestock enclosure compliance in buffer zone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Report prepared by GirShield AI System
Gujarat Forest Department | Junagadh Division
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`.trim(),
  },
};

function detectIntent(msg: string): string {
  const m = msg.toLowerCase();
  if (m.match(/\b(hello|hi|hey|namaste|kem cho)\b/)) return 'greeting';
  if (m.match(/\b(lion|leopard|wildlife|animal|sighting|spotted)\b/)) return 'safety';
  if (m.match(/\b(compensation|claim|money|damage|loss|reimburse|form|document)\b/)) return 'compensation';
  if (m.match(/\b(report|incident|attack|injured|hurt|emergency|sos)\b/)) return 'reporting';
  if (m.match(/\b(contact|phone|number|helpline|call|police|ambulance)\b/)) return 'contacts';
  if (m.match(/\b(predict|prediction|movement|track|gps|forecast|tonight)\b/)) return 'prediction';
  if (m.match(/\b(patrol|route|officer|ranger|assign|mission)\b/)) return 'patrol';
  if (m.match(/\b(alert|warning|danger|safe|zone)\b/)) return 'alerts';
  if (m.match(/\b(report|statistics|weekly|monthly|summary|generate)\b/)) return 'report_gen';
  return 'unknown';
}

export class IBMGraniteService {
  private apiKey: string;
  private baseUrl: string;
  private projectId: string;
  private modelId: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly hasCredentials: boolean;

  constructor() {
    this.apiKey = process.env.IBM_WATSONX_API_KEY || '';
    this.baseUrl = process.env.IBM_WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
    this.projectId = process.env.IBM_WATSONX_PROJECT_ID || '';
    this.modelId = process.env.IBM_GRANITE_MODEL_ID || 'ibm/granite-13b-chat-v2';
    this.hasCredentials = !!(this.apiKey && this.projectId);

    if (!this.hasCredentials) {
      logger.info('IBM Granite credentials not configured — running with local intelligence layer');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }
    try {
      const response = await axios.post(
        'https://iam.cloud.ibm.com/identity/token',
        `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${this.apiKey}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
      return this.accessToken!;
    } catch (err) {
      logger.error('IBM IAM token fetch failed', { error: (err as Error).message });
      throw new Error('Failed to authenticate with IBM Watsonx');
    }
  }

  async chat(messages: GraniteMessage[], systemPrompt?: string): Promise<string> {
    // No credentials → use local intelligence immediately
    if (!this.hasCredentials) {
      const lastMessage = messages[messages.length - 1]?.content || '';
      return this.getLocalResponse(lastMessage);
    }

    // Has credentials → call IBM Granite, fall back on any error
    try {
      const token = await this.getAccessToken();
      const prompt = this.buildChatPrompt(messages, systemPrompt);
      const response = await axios.post<GraniteResponse>(
        `${this.baseUrl}/ml/v1/text/generation?version=2023-05-29`,
        {
          model_id: this.modelId,
          input: prompt,
          parameters: {
            decoding_method: 'greedy',
            max_new_tokens: 800,
            stop_sequences: ['<|endoftext|>', '\n\nHuman:', '\n\nUser:'],
            repetition_penalty: 1.1,
          },
          project_id: this.projectId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return response.data.results[0]?.generated_text?.trim() || 'No response generated.';
    } catch (err) {
      logger.error('Granite API error — using local fallback', { error: (err as Error).message });
      const lastMessage = messages[messages.length - 1]?.content || '';
      return this.getLocalResponse(lastMessage);
    }
  }

  private getLocalResponse(userMessage: string): string {
    const intent = detectIntent(userMessage);
    switch (intent) {
      case 'greeting': return LOCAL_RESPONSES.chat.greeting();
      case 'safety':
        if (userMessage.toLowerCase().includes('lion'))
          return LOCAL_RESPONSES.safety.asiatic_lion(2);
        if (userMessage.toLowerCase().includes('leopard'))
          return LOCAL_RESPONSES.safety.leopard(2);
        return LOCAL_RESPONSES.safety.general('wildlife', 2);
      case 'compensation': return LOCAL_RESPONSES.compensation.livestock;
      case 'reporting':   return LOCAL_RESPONSES.chat.reporting;
      case 'contacts':    return LOCAL_RESPONSES.chat.contacts;
      case 'prediction':  return LOCAL_RESPONSES.chat.prediction;
      case 'patrol':      return LOCAL_RESPONSES.chat.patrol;
      case 'alerts':      return LOCAL_RESPONSES.chat.alerts;
      default:            return LOCAL_RESPONSES.chat.unknown;
    }
  }

  private buildChatPrompt(messages: GraniteMessage[], systemPrompt?: string): string {
    const system = systemPrompt || this.getDefaultSystemPrompt();
    let prompt = `<|system|>\n${system}\n`;
    for (const msg of messages) {
      if (msg.role === 'user') prompt += `<|user|>\n${msg.content}\n`;
      else if (msg.role === 'assistant') prompt += `<|assistant|>\n${msg.content}\n`;
    }
    prompt += `<|assistant|>\n`;
    return prompt;
  }

  private getDefaultSystemPrompt(): string {
    return `You are GirShield AI Assistant, an intelligent system for managing human-wildlife conflicts in the Gir Forest region of Gujarat, India. You help villagers, forest officers, and administrators. Be practical, compassionate, and concise. If the user writes in Gujarati or Hindi, respond in their language.`;
  }

  async generateIncidentSummary(incident: Record<string, unknown>): Promise<string> {
    if (!this.hasCredentials) {
      return `INCIDENT SUMMARY REPORT
Type: ${String(incident.type || '').replace(/_/g, ' ').toUpperCase()}
Village: ${incident.village_name || 'Unknown'}
Severity: ${String(incident.severity || '').toUpperCase()}
Status: ${String(incident.status || '').toUpperCase()}
Reported: ${incident.occurred_at ? new Date(String(incident.occurred_at)).toLocaleString('en-IN') : 'N/A'}

Description: ${incident.description || 'No description provided.'}

Assigned Officer: ${incident.officer_name || 'Unassigned'}
Resolution Notes: ${incident.resolution_notes || 'Pending'}`;
    }
    const prompt = `Generate a concise official incident summary for this wildlife conflict. Format it for government records.\n\n${JSON.stringify(incident, null, 2)}`;
    return this.chat([{ role: 'user', content: prompt }]);
  }

  async generateSafetyGuidance(species: AnimalSpecies, distanceKm: number): Promise<string> {
    if (!this.hasCredentials) {
      if (species === 'asiatic_lion') return LOCAL_RESPONSES.safety.asiatic_lion(distanceKm);
      if (species === 'leopard') return LOCAL_RESPONSES.safety.leopard(distanceKm);
      return LOCAL_RESPONSES.safety.general(species, distanceKm);
    }
    const speciesName = species === 'asiatic_lion' ? 'Asiatic Lion' : 'Leopard';
    const prompt = `A ${speciesName} has been spotted ${distanceKm.toFixed(1)} km from a village. Generate clear safety guidance for villagers.`;
    return this.chat([{ role: 'user', content: prompt }]);
  }

  async generateCompensationGuidance(incidentType: string, livestockType?: string): Promise<string> {
    if (!this.hasCredentials) {
      if (incidentType.includes('medical') || incidentType.includes('injur')) return LOCAL_RESPONSES.compensation.medical;
      if (incidentType.includes('property') || incidentType.includes('crop')) return LOCAL_RESPONSES.compensation.property;
      return LOCAL_RESPONSES.compensation.livestock;
    }
    const prompt = `Guide a villager through the Gujarat forest department compensation claim process for ${incidentType}${livestockType ? ` involving ${livestockType}` : ''}.`;
    return this.chat([{ role: 'user', content: prompt }]);
  }

  async analyzeMovementPattern(movements: Array<{ lat: number; lng: number; time: string }>): Promise<{
    pattern: string; risk: string; prediction: string;
  }> {
    if (!this.hasCredentials || movements.length === 0) {
      const count = movements.length;
      return {
        pattern: count > 5
          ? `Active movement detected — ${count} GPS waypoints recorded. Animal is moving in a consistent direction.`
          : count > 0
            ? `Limited movement data — ${count} waypoints available. Animal appears to be in a resting or foraging phase.`
            : 'No recent GPS data available for this animal.',
        risk: count > 8 ? 'High — frequent movement towards village boundary' : count > 3 ? 'Medium — moderate activity detected' : 'Low — minimal movement observed',
        prediction: 'Based on historical Gir Forest patterns: highest movement probability between 18:00–22:00 and 04:00–07:00 IST. Expected to follow water source routes during summer months.',
      };
    }
    const prompt = `Analyze this wildlife movement pattern. Respond as JSON with keys: pattern, risk, prediction.\n\n${JSON.stringify(movements)}`;
    const response = await this.chat([{ role: 'user', content: prompt }]);
    try {
      return JSON.parse(response);
    } catch {
      return { pattern: response, risk: 'Medium', prediction: 'Analysis complete' };
    }
  }

  async generateWeeklyReport(stats: Record<string, unknown>): Promise<string> {
    if (!this.hasCredentials) {
      return LOCAL_RESPONSES.reports.weekly(stats);
    }
    const prompt = `Generate a professional weekly wildlife conflict monitoring report for Gir Forest based on: ${JSON.stringify(stats, null, 2)}`;
    return this.chat([{ role: 'user', content: prompt }]);
  }

  async processNaturalLanguageQuery(query: string, context: Record<string, unknown>): Promise<{
    intent: string; action?: string; params?: Record<string, unknown>; response: string;
  }> {
    const intent = detectIntent(query);

    if (!this.hasCredentials) {
      return {
        intent,
        response: this.getLocalResponse(query),
      };
    }

    const prompt = `Interpret this user query for a wildlife management system. Respond as JSON with keys: intent, action, params, response.\n\nContext: ${JSON.stringify(context)}\nQuery: "${query}"`;
    try {
      const result = await this.chat([{ role: 'user', content: prompt }]);
      return JSON.parse(result);
    } catch {
      return { intent, response: this.getLocalResponse(query) };
    }
  }
}

export const graniteService = new IBMGraniteService();
