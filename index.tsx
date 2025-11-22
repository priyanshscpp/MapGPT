/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { GoogleGenAI, mcpToTool } from '@google/genai';
import { ChatState, marked, Playground } from './playground';

import { startMcpGoogleMapServer } from './mcp_maps_server';

/* --------- */


async function startClient(transport: Transport) {
  const client = new Client({ name: "AI Studio", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

/* ------------ */


const SYSTEM_INSTRUCTIONS = `You are an expert geo-intelligence assistant proficient with maps and discovering interesting places.

TOOL USAGE GUIDE:
1. **For location name queries** (e.g., "Tell me about Prayagraj", "What's in Paris?"):
   - First use geocode_location to convert the place name to coordinates
   - Then use reverse_geo_insights with those coordinates to get detailed insights, landmarks, weather, and AI summary
   - Also use view_location_google_maps to show it on the map
   - Return the comprehensive insights including landmarks, weather, popularity, and safety info

2. **For shareable link requests** (e.g., "Create a shareable link for Taj Mahal", "Share this location"):
   - Use geocode_location to get coordinates from the place name
   - Use share_location with those coordinates to generate the shareable link
   - Display the link and information to the user

3. **For weather queries** (e.g., "What's the weather in Tokyo?", "How's the weather in London?"):
   - Use geocode_location to convert the place name to coordinates
   - Use weather_at_location with those coordinates to get current weather
   - Present the weather data clearly

4. **For navigation/viewing** (e.g., "Show me Paris on the map", "Display Singapore"):
   - Use view_location_google_maps to show the location
   - Optionally also provide insights using reverse_geo_insights if user wants details

ALWAYS:
- Explain what you're doing before calling tools
- Use tools proactively without asking for coordinates - convert place names automatically
- Return comprehensive, well-structured information
- Be helpful and informative`;

const EXAMPLE_PROMPTS = [
  'Tell me everything about Prayagraj',
  'Show me Paris and give me insights',
  'Create a shareable link for Taj Mahal',
  'What\'s the weather in Tokyo right now?',
  'Tell me about the Eiffel Tower',
  'Show me Rome and what it\'s known for',
  'Weather in London',
  'Insights about New York City',
  'Can you share the location of Big Ben?',
  'What are the landmarks near Big Ben?',
  'Current weather in Dubai',
  'Tell me about Mount Everest'
];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function createAiChat(mcpClient: Client) {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      tools: [mcpToTool(mcpClient)],
    },
  });
}

function camelCaseToDash(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const rootElement = document.querySelector('#root')! as HTMLElement;

  const playground = new Playground();
  rootElement.appendChild(playground);

  playground.renderMapQuery({ location: 'London' });


  // ---------

  const [transportA, transportB] = InMemoryTransport.createLinkedPair();

  void startMcpGoogleMapServer(transportA, (params: { location?: string, origin?: string, destination?: string, search?: string }) => {
    playground.renderMapQuery(params);
  });

  const mcpClient = await startClient(transportB);

  // --------

  const aiChat = createAiChat(mcpClient);

  playground.sendMessageHandler = async (
    input: string,
    role: string,
  ) => {
    console.log(
      'sendMessageHandler',
      input,
      role
    );

    const { thinking, text } = playground.addMessage('assistant', '');
    const message = [];

    message.push({
      role,
      text: input,
    });

    playground.setChatState(ChatState.GENERATING);

    text.innerHTML = '...';

    let newCode = '';
    let thought = '';


    try {
      const res = await aiChat.sendMessageStream({ message });

      for await (const chunk of res) {
        for (const candidate of chunk.candidates ?? []) {
          for (const part of candidate.content?.parts ?? []) {
            if (part.functionCall) {
              console.log('FUNCTION CALL:', part.functionCall.name, part.functionCall.args);
              const mcpCall = {
                name: camelCaseToDash(part.functionCall.name!),
                arguments: part.functionCall.args
              };

              const explanation = 'Calling function:\n```json\n' + JSON.stringify(mcpCall, null, 2) + '\n```'
              const { thinking, text } = playground.addMessage('assistant', '');
              text.innerHTML = await marked.parse(explanation);
            }

            if (part.thought) {
              playground.setChatState(ChatState.THINKING);
              if (part.text) {
                thought += part.text;
                thinking.innerHTML = await marked.parse(thought);
                thinking.parentElement!.classList.remove('hidden');
              }
            } else if (part.text) {
              playground.setChatState(ChatState.EXECUTING);
              newCode += part.text;
              text.innerHTML = await marked.parse(newCode);
            }
            playground.scrollToTheEnd();
          }
        }
      }
    } catch (e: any) {
      console.error('GenAI SDK Error:', e.message);
      let message = e.message;
      const splitPos = e.message.indexOf('{');
      if (splitPos > -1) {
        const msgJson = e.message.substring(splitPos);
        try {
          const sdkError = JSON.parse(msgJson);
          if (sdkError.error) {
            message = sdkError.error.message;
            message = await marked.parse(message);
          }
        } catch (e) {
          console.error('Unable to parse the error message:', e);
        }
      }
      const { text } = playground.addMessage('error', '');
      text.innerHTML = message;
    }

    // close thinking block
    thinking.parentElement!.removeAttribute('open');

    // If the answer was just code
    if (text.innerHTML.trim().length === 0) {
      text.innerHTML = 'Done';
    }

    playground.setChatState(ChatState.IDLE);
  };

  playground.setInputField(
    EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)],
  );
});
