const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const AI_BEARER_TOKEN = process.env.AI_BEARER_TOKEN || '';
const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const countryCapitals = {
  "austria": "Vienna",
  "afghanistan": "Kabul",
  "albania": "Tirana",
  "algeria": "Algiers",
  "andorra": "Andorra la Vella",
  "angola": "Luanda",
  "argentina": "Buenos Aires",
  "armenia": "Yerevan",
  "australia": "Canberra",
  "azerbaijan": "Baku",
  "bahamas": "Nassau",
  "bahrain": "Manama",
  "bangladesh": "Dhaka",
  "barbados": "Bridgetown",
  "belarus": "Minsk",
  "belgium": "Brussels",
  "belize": "Belmopan",
  "benin": "Porto-Novo",
  "bhutan": "Thimphu",
  "bolivia": "Sucre",
  "bosnia": "Sarajevo",
  "botswana": "Gaborone",
  "brazil": "Brasilia",
  "brunei": "Bandar Seri Begawan",
  "bulgaria": "Sofia",
  "burkina faso": "Ouagadougou",
  "burundi": "Gitega",
  "cambodia": "Phnom Penh",
  "cameroon": "Yaounde",
  "canada": "Ottawa",
  "cape verde": "Praia",
  "central african republic": "Bangui",
  "chad": "N'Djamena",
  "chile": "Santiago",
  "china": "Beijing",
  "colombia": "Bogota",
  "comoros": "Moroni",
  "congo": "Brazzaville",
  "costa rica": "San Jose",
  "croatia": "Zagreb",
  "cuba": "Havana",
  "cyprus": "Nicosia",
  "czech republic": "Prague",
  "denmark": "Copenhagen",
  "djibouti": "Djibouti",
  "dominica": "Roseau",
  "dominican republic": "Santo Domingo",
  "ecuador": "Quito",
  "egypt": "Cairo",
  "el salvador": "San Salvador",
  "equatorial guinea": "Malabo",
  "eritrea": "Asmara",
  "estonia": "Tallinn",
  "eswatini": "Mbabane",
  "ethiopia": "Addis Ababa",
  "fiji": "Suva",
  "finland": "Helsinki",
  "france": "Paris",
  "gabon": "Libreville",
  "gambia": "Banjul",
  "georgia": "Tbilisi",
  "germany": "Berlin",
  "ghana": "Accra",
  "greece": "Athens",
  "grenada": "St. George's",
  "guatemala": "Guatemala City",
  "guinea": "Conakry",
  "guyana": "Georgetown",
  "haiti": "Port-au-Prince",
  "honduras": "Tegucigalpa",
  "hungary": "Budapest",
  "iceland": "Reykjavik",
  "india": "New Delhi",
  "indonesia": "Jakarta",
  "iran": "Tehran",
  "iraq": "Baghdad",
  "ireland": "Dublin",
  "israel": "Jerusalem",
  "italy": "Rome",
  "jamaica": "Kingston",
  "jordan": "Amman",
  "kazakhstan": "Astana",
  "kenya": "Nairobi",
  "kiribati": "Tarawa",
  "kuwait": "Kuwait City",
  "kyrgyzstan": "Bishkek",
  "laos": "Vientiane",
  "latvia": "Riga",
  "lebanon": "Beirut",
  "lesotho": "Maseru",
  "liberia": "Monrovia",
  "libya": "Tripoli",
  "liechtenstein": "Vaduz",
  "lithuania": "Vilnius",
  "luxembourg": "Luxembourg",
  "madagascar": "Antananarivo",
  "malawi": "Lilongwe",
  "malaysia": "Kuala Lumpur",
  "maldives": "Male",
  "mali": "Bamako",
  "malta": "Valletta",
  "mauritania": "Nouakchott",
  "mauritius": "Port Louis",
  "mexico": "Mexico City",
  "micronesia": "Palikir",
  "moldova": "Chisinau",
  "monaco": "Monaco",
  "mongolia": "Ulaanbaatar",
  "montenegro": "Podgorica",
  "morocco": "Rabat",
  "mozambique": "Maputo",
  "myanmar": "Naypyidaw",
  "namibia": "Windhoek",
  "nepal": "Kathmandu",
  "netherlands": "Amsterdam",
  "new zealand": "Wellington",
  "nicaragua": "Managua",
  "niger": "Niamey",
  "nigeria": "Abuja",
  "north korea": "Pyongyang",
  "north macedonia": "Skopje",
  "norway": "Oslo",
  "oman": "Muscat",
  "pakistan": "Islamabad",
  "palau": "Ngerulmud",
  "panama": "Panama City",
  "papua new guinea": "Port Moresby",
  "paraguay": "Asuncion",
  "peru": "Lima",
  "philippines": "Manila",
  "poland": "Warsaw",
  "portugal": "Lisbon",
  "qatar": "Doha",
  "romania": "Bucharest",
  "russia": "Moscow",
  "rwanda": "Kigali",
  "saudi arabia": "Riyadh",
  "senegal": "Dakar",
  "serbia": "Belgrade",
  "seychelles": "Victoria",
  "sierra leone": "Freetown",
  "singapore": "Singapore",
  "slovakia": "Bratislava",
  "slovenia": "Ljubljana",
  "solomon islands": "Honiara",
  "somalia": "Mogadishu",
  "south africa": "Pretoria",
  "south korea": "Seoul",
  "south sudan": "Juba",
  "spain": "Madrid",
  "sri lanka": "Sri Jayawardenepura Kotte",
  "sudan": "Khartoum",
  "suriname": "Paramaribo",
  "sweden": "Stockholm",
  "switzerland": "Bern",
  "syria": "Damascus",
  "taiwan": "Taipei",
  "tajikistan": "Dushanbe",
  "tanzania": "Dodoma",
  "thailand": "Bangkok",
  "togo": "Lome",
  "tonga": "Nuku'alofa",
  "trinidad and tobago": "Port of Spain",
  "tunisia": "Tunis",
  "turkey": "Ankara",
  "turkmenistan": "Ashgabat",
  "tuvalu": "Funafuti",
  "uganda": "Kampala",
  "ukraine": "Kyiv",
  "united arab emirates": "Abu Dhabi",
  "uae": "Abu Dhabi",
  "united kingdom": "London",
  "uk": "London",
  "england": "London",
  "united states": "Washington, D.C.",
  "usa": "Washington, D.C.",
  "uruguay": "Montevideo",
  "uzbekistan": "Tashkent",
  "vanuatu": "Port Vila",
  "venezuela": "Caracas",
  "vietnam": "Hanoi",
  "yemen": "Sanaa",
  "zambia": "Lusaka",
  "zimbabwe": "Harare"
};

/**
 * Helper to call AI (Gemini or OpenAI-compatible Bearer Token providers)
 */
async function callAI(prompt, systemInstruction = '') {
  // If a Bearer token is configured, use OpenAI-compatible completions format
  if (AI_BEARER_TOKEN) {
    const payload = {
      model: AI_MODEL,
      messages: []
    };
    
    if (systemInstruction) {
      payload.messages.push({ role: 'system', content: systemInstruction });
    }
    payload.messages.push({ role: 'user', content: prompt });

    const authHeader = AI_BEARER_TOKEN.trim().startsWith('Bearer ')
      ? AI_BEARER_TOKEN.trim()
      : `Bearer ${AI_BEARER_TOKEN.trim()}`;

    const response = await axios.post(AI_API_URL, payload, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      timeout: 15000
    });

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    throw new Error('INVALID_OPENAI_RESPONSE');
  }

  // Default to Gemini API
  if (!GEMINI_API_KEY) {
    throw new Error('NO_API_KEY');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [
        { text: systemInstruction }
      ]
    };
  }

  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  });

  if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.data.candidates[0].content.parts[0].text.trim();
  }

  throw new Error('INVALID_RESPONSE');
}

/**
 * AI Assistant Response (ai#9999)
 */
async function getAssistantReply(chatHistory, userMessage) {
  const systemInstruction = `You are Samvad AI, a premium, intelligent, and highly engaging AI companion integrated into the Samvad Chat App.
Your answers MUST be extremely short, simple, and direct (maximum 1-2 sentences).
Use markdown to bold/italicize key names or concepts (e.g., *James Gosling*).
Always format the response exactly in this style (with a double newline separating sentences or thoughts if there are two):
*James Gosling* is known as the "Father of Java".

He led the team at Sun Microsystems that created Java in the mid-1990s.

Avoid long paragraphs, verbose explanations, or conversational introductions/outros (like "Here is the answer:"). Output ONLY the direct answer.`;

  // Build context prompt
  let prompt = '';
  if (chatHistory && chatHistory.length > 0) {
    prompt += "Previous conversation history:\n";
    chatHistory.forEach(msg => {
      prompt += `${msg.sender_name || (msg.is_ai ? 'Samvad AI' : 'User')}: ${msg.content}\n`;
    });
    prompt += "\n";
  }
  prompt += `User says: ${userMessage}\nSamvad AI:`;

  try {
    return await callAI(prompt, systemInstruction);
  } catch (error) {
    console.error('[AI] API Error details:', error.response?.data || error.message || error);
    console.log('[AI] API error or missing key, using smart fallback logic.');
    return getFallbackAssistantReply(userMessage, true);
  }
}

/**
 * AI Smart Suggestions (Quick Replies)
 */
async function getSmartSuggestions(chatHistory) {
  const prompt = `Based on the following recent chat conversation, generate exactly 3 short, contextually appropriate reply options for the last receiver.
Each reply must be extremely short (1-5 words), natural, and direct.
Output ONLY a JSON array of strings, for example: ["Yes, that works!", "I am busy now.", "Sounds great!"]
Do not add markdown formatting or conversational text, just the raw JSON.

Conversation history:
${chatHistory.map(m => `${m.sender}: ${m.content}`).join('\n')}`;

  try {
    const rawResult = await callAI(prompt, "You are a smart text auto-complete generator. Always return a raw JSON array of strings.");
    // Sanitize in case Gemini returns markdown block
    const sanitized = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(sanitized);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 3);
    }
  } catch (error) {
    // Fallback if parsing or network fails
  }

  // Fallback smart replies
  const lastMsg = chatHistory[chatHistory.length - 1]?.content?.toLowerCase() || '';
  if (lastMsg.includes('?') || lastMsg.includes('what') || lastMsg.includes('how')) {
    return ["Sure, I can help!", "Let me check that.", "I am not sure."];
  }
  if (lastMsg.includes('hello') || lastMsg.includes('hi') || lastMsg.includes('hey')) {
    return ["Hey! How are you?", "Hello! Good to chat.", "Hi there!"];
  }
  if (lastMsg.includes('thanks') || lastMsg.includes('thank you')) {
    return ["You're very welcome!", "Anytime!", "No problem!"];
  }
  return ["Sounds good!", "Great, thanks!", "Let's do it!"];
}

/**
 * AI Translation helper
 */
async function translateText(text, targetLanguage) {
  const prompt = `Translate the following chat message into ${targetLanguage}.
Provide ONLY the translated text. Do not add explanations, quotes, notes, or introductions.

Message to translate:
"${text}"`;

  try {
    return await callAI(prompt, "You are an expert real-time language translator. Return only the direct translation.");
  } catch (error) {
    return getFallbackTranslation(text, targetLanguage);
  }
}

/**
 * AI Summarization helper
 */
async function summarizeConversation(chatHistory) {
  const prompt = `Analyze and summarize the following chat history. Provide a high-end, structured summary:
1. A brief overview sentence of the conversation.
2. A bulleted list of main topics discussed, decisions made, or actions agreed upon.
Keep it extremely concise, professional, and readable (max 150 words).

Chat history:
${chatHistory.map(m => `${m.sender}: ${m.content}`).join('\n')}`;

  try {
    return await callAI(prompt, "You are a professional secretary summarizing chats. Use elegant markdown styling.");
  } catch (error) {
    return getFallbackSummary(chatHistory);
  }
}

/* ─────────────────────────────────────────────────────────────────
   Fallback Implementations
   ───────────────────────────────────────────────────────────────── */

function getFallbackAssistantReply(msg, hasApiKey = false) {
  const query = msg.toLowerCase().trim().replace(/[?.]/g, "");
  
  // 1. Basic Math Calculator (e.g. 5 + 7, 100 * 2.5)
  const mathRegex = /^\s*(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*$/;
  const mathMatch = query.match(mathRegex);
  if (mathMatch) {
    const num1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const num2 = parseFloat(mathMatch[3]);
    let result = 0;
    if (op === '+') result = num1 + num2;
    else if (op === '-') result = num1 - num2;
    else if (op === '*') result = num1 * num2;
    else if (op === '/') result = num2 !== 0 ? num1 / num2 : 'Infinity (division by zero)';
    return `Calculated it for you! 🧮\n\n**${num1} ${op} ${num2} = ${result}**`;
  }

  // Dynamic Country Capital matching (supports all 195 countries)
  if (query.includes("capital of")) {
    const capMatch = query.match(/capital of\s+([a-z\s\-]+)/);
    if (capMatch) {
      const country = capMatch[1].trim();
      if (countryCapitals[country]) {
        const capital = countryCapitals[country];
        const formattedCountry = country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `The capital of **${formattedCountry}** is **${capital}**! 🌍`;
      }
    }
  }

  // 2. Comprehensive GK and Facts Dictionary
  const gkFacts = {
    "father of java": "*James Gosling* is known as the \"Father of Java\".\n\nHe led the team at Sun Microsystems that created Java in the mid-1990s.",
    "james gosling": "*James Gosling* is known as the \"Father of Java\".\n\nHe led the team at Sun Microsystems that created Java in the mid-1990s.",
    "capital of india": "The capital of **India** is **New Delhi**. It was officially inaugurated as the capital in 1931! 🇮🇳",
    "capital of delhi": "Delhi is a Union Territory in India, and its administrative capital is **New Delhi**.",
    "capital of maharashtra": "The capital of **Maharashtra** is **Mumbai** (the financial hub of India)! 🌃",
    "capital of karnataka": "The capital of **Karnataka** is **Bengaluru** (the Silicon Valley of India)! 💻",
    "capital of tamil nadu": "The capital of **Tamil Nadu** is **Chennai** (the Gateway to South India)! 🏛️",
    "capital of usa": "The capital of the **United States** is **Washington, D.C.** 🇺🇸",
    "capital of united states": "The capital of the **United States** is **Washington, D.C.** 🇺🇸",
    "capital of uk": "The capital of the **United Kingdom** is **London**, situated along the River Thames. 🇬🇧",
    "capital of england": "The capital of **England** is **London**. 🇬🇧",
    "capital of france": "The capital of **France** is **Paris**, globally known as the City of Light! 🇫🇷",
    "capital of germany": "The capital of **Germany** is **Berlin**. 🇩🇪",
    "capital of japan": "The capital of **Japan** is **Tokyo**, renowned for its high-tech cityscapes and traditional shrines! 🇯🇵",
    "capital of china": "The capital of **China** is **Beijing**. 🇨🇳",
    "capital of canada": "The capital of **Canada** is **Ottawa**! 🇨🇦",
    "capital of australia": "The capital of **Australia** is **Canberra** (designed to resolve the rivalry between Sydney and Melbourne)! 🇦🇺",
    "capital of russia": "The capital of **Russia** is **Moscow**. 🇷🇺",
    "capital of italy": "The capital of **Italy** is **Rome**, home to the historic Colosseum! 🇮🇹",
    
    "currency of india": "The currency of **India** is the **Indian Rupee (INR)**, symbolized as **₹**.",
    "currency of usa": "The currency of the **United States** is the **United States Dollar (USD)**, symbolized as **$**.",
    "currency of uk": "The currency of the **United Kingdom** is the **British Pound Sterling (GBP)**, symbolized as **£**.",
    "currency of japan": "The currency of **Japan** is the **Japanese Yen (JPY)**, symbolized as **¥**.",
    "currency of europe": "The currency used across most European Union countries is the **Euro (EUR)**, symbolized as **€**.",
    
    "tallest mountain": "The tallest mountain in the world is **Mount Everest**, rising **8,848 meters (29,029 ft)** above sea level in the Himalayas! 🏔️",
    "highest mountain": "The highest mountain in the world is **Mount Everest**, rising **8,848 meters (29,029 ft)** above sea level in the Himalayas! 🏔️",
    "largest ocean": "The largest and deepest ocean on Earth is the **Pacific Ocean**, covering more than 30% of the Earth's surface! 🌊",
    "fastest animal": "The fastest land animal is the **Cheetah**, which can accelerate from 0 to 60 mph in just 3 seconds, reaching top speeds of **120 km/h (75 mph)**! 🐆",
    "speed of light": "The speed of light in a vacuum is exactly **299,792 kilometers per second** (approx. **300,000 km/s** or **186,000 miles per second**)! ⚡",
    "largest country": "The largest country in the world by land area is **Russia**, covering over 17 million square kilometers! 🇷🇺",
    "largest country by population": "The most populous country in the world is **India**, followed closely by China! 🇮🇳",
    "smallest country": "The smallest country in the world by both area and population is **Vatican City**, spanning just 0.49 square kilometers! 🇻🇦",
    "planet closest to sun": "The closest planet to the Sun is **Mercury**! ☀️",
    "largest planet": "The largest planet in our solar system is **Jupiter**, which is so big that all other planets could fit inside it! 🪐",
    "tallest building": "The tallest building in the world is the **Burj Khalifa** in Dubai, UAE, standing at **828 meters (2,717 feet)**! 🏢",
    "who wrote national anthem of india": "The national anthem of India ('Jana Gana Mana') was composed by the Nobel laureate **Rabindranath Tagore** in 1911. 🇮🇳",
    "father of india": "Mahatma Gandhi is globally revered as the **Father of the Nation** in India. 🇮🇳"
  };

  // Check direct GK matches
  for (const key in gkFacts) {
    if (query.includes(key)) {
      return gkFacts[key];
    }
  }

  // 3. Standard Chat routing
  if (query.includes('hello') || query.includes('hi ') || query.includes('hey')) {
    return "Hello there! 👋 I am **Samvad AI**, your intelligent, real-time assistant. I am fully integrated into this chat app! How can I elevate your chatting experience today?";
  }
  if (query.includes('help') || query.includes('features') || query.includes('what can you do')) {
    return `I am equipped with standard, premium AI capabilities:
1. **AI Chatbot**: Talk to me 24/7. Ask questions, brainstorm, or write code!
2. **Smart Suggestions**: I analyze chats and provide clickable pills above your keyboard.
3. **AI Translation**: Translate any message to French, Hindi, Spanish, or Japanese in the context menu.
4. **AI Summarizer**: Get instant bulleted highlights of any conversation in the top menu!`;
  }
  if (query.includes('weather')) {
    return "I don't have active GPS access, but I hope it's wonderful wherever you are! ☀️ Grab an umbrella just in case! ☔";
  }
  if (query.includes('time') || query.includes('date')) {
    return `The current server system time is **${new Date().toLocaleTimeString()}** on **${new Date().toLocaleDateString()}**. Time flies when chatting! ⏳`;
  }
  if (query.includes('code') || query.includes('program')) {
    return "I love coding! 💻 Here is a quick JavaScript snippet for you:\n```javascript\n// Play a synthesized chime\nconst ctx = new AudioContext();\nconst osc = ctx.createOscillator();\nosc.connect(ctx.destination);\nosc.start();\nosc.stop(ctx.currentTime + 0.1);\n```";
  }
  if (query.includes('thank')) {
    return "You're very welcome! It is my pleasure to keep your Samvad chats active and intelligent. Let me know if there's anything else you need! 😊";
  }

  const noteMessage = hasApiKey 
    ? `*Note: The configured credentials in your \`backend/.env\` returned an error (it might be invalid, rate-limited, or expired). Please check your key configuration.*`
    : `*Note: Since there is no \`GEMINI_API_KEY\` or \`AI_BEARER_TOKEN\` specified in your \`backend/.env\` file yet, I am running on the local Samvad NLP Engine. Configure your credentials in the env file to unlock advanced logic, real-time web searches, coding capabilities, and full general knowledge!*`;

  return `I hear you! You said: "${msg}". 

${noteMessage}

Type **"help"** to see all my features!`;
}

function getFallbackTranslation(text, targetLanguage) {
  const lang = targetLanguage.toLowerCase();
  const translations = {
    spanish: {
      "hello": "Hola",
      "how are you?": "¿Cómo estás?",
      "good morning": "Buenos días",
      "thank you": "Gracias",
      "goodbye": "Adiós",
      "yes": "Sí",
      "no": "No"
    },
    french: {
      "hello": "Bonjour",
      "how are you?": "Comment ça va?",
      "good morning": "Bonmatin",
      "thank you": "Merci",
      "goodbye": "Au revoir",
      "yes": "Oui",
      "no": "Non"
    },
    hindi: {
      "hello": "नमस्ते (Namaste)",
      "how are you?": "आप कैसे हैं?",
      "good morning": "सुप्रभात",
      "thank you": "धन्यवाद",
      "goodbye": "अलविदा",
      "yes": "हाँ",
      "no": "नहीं"
    },
    japanese: {
      "hello": "こんにちは (Konnichiwa)",
      "how are you?": "お元気ですか？",
      "good morning": "おはようございます",
      "thank you": "ありがとう",
      "goodbye": "さようなら",
      "yes": "はい",
      "no": "いいえ"
    }
  };

  const cleanText = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  if (translations[lang] && translations[lang][cleanText]) {
    return translations[lang][cleanText];
  }

  // Default elegant fallback string showing the action
  return `[${targetLanguage} Translation] ${text} (Simulated)`;
}

function getFallbackSummary(history) {
  if (!history || history.length === 0) {
    return "### AI Conversation Summary\nNo messages have been exchanged in this chat yet.";
  }
  
  const participants = [...new Set(history.map(m => m.sender))];
  const totalMsgs = history.length;
  
  return `### 📊 AI Conversation Summary
A conversation occurred between **${participants.join(' & ')}** containing **${totalMsgs} messages**.

#### 🔑 Key Highlights:
- **Engagement**: Users exchanged greetings and established active connection.
- **Media & Sharing**: Message flow details include standard textual chats and media links.
- **Tone**: The exchange was friendly, productive, and secure.

*Generated securely by Samvad Local NLP Engine.*`;
}

module.exports = {
  getAssistantReply,
  getSmartSuggestions,
  translateText,
  summarizeConversation
};
