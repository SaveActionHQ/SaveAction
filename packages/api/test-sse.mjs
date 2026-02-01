/**
 * Manual SSE Test Script
 * 
 * Tests the real-time run progress SSE endpoint.
 * Run with: node test-sse.mjs
 */

const API_URL = 'http://localhost:3001/api/v1';

// Simple recording for testing
const testRecording = {
  id: 'rec_test_sse_' + Date.now(),
  testName: 'SSE Test Recording',
  url: 'https://example.com',
  startTime: new Date().toISOString(),
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 Test',
  actions: [
    {
      id: 'act_001',
      type: 'navigation',
      timestamp: Date.now(),
      url: 'https://example.com',
      toUrl: 'https://example.com',
    },
    {
      id: 'act_002',
      type: 'click',
      timestamp: Date.now() + 1000,
      url: 'https://example.com',
      selector: {
        css: 'body',
        xpath: '//body',
      },
      clickCount: 1,
      button: 'left',
    },
  ],
  version: '1.0.0',
};

async function main() {
  console.log('🧪 SSE Manual Test\n');

  // 1. Register a test user
  console.log('1️⃣ Registering test user...');
  const email = `sse-test-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  const registerRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'SSE Tester' }),
  });

  if (!registerRes.ok) {
    const error = await registerRes.json();
    console.error('Registration failed:', error);
    return;
  }

  const registerData = await registerRes.json();
  const accessToken = registerData.data.tokens.accessToken;
  console.log('   ✅ User registered\n');

  // 2. Upload a recording
  console.log('2️⃣ Uploading test recording...');
  const uploadRes = await fetch(`${API_URL}/recordings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: testRecording.testName,
      data: testRecording,
      tags: ['sse-test'],
    }),
  });

  if (!uploadRes.ok) {
    const error = await uploadRes.json();
    console.error('Upload failed:', error);
    return;
  }

  const { data: recording } = await uploadRes.json();
  console.log(`   ✅ Recording uploaded: ${recording.id}\n`);

  // 3. Start SSE connection BEFORE triggering the run
  console.log('3️⃣ Triggering test run...');
  const runRes = await fetch(`${API_URL}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recordingId: recording.id,
      browser: 'chromium',
      headless: true,
    }),
  });

  if (!runRes.ok) {
    const error = await runRes.json();
    console.error('Run trigger failed:', error);
    return;
  }

  const { data: run } = await runRes.json();
  console.log(`   ✅ Run queued: ${run.id}\n`);

  // 4. Connect to SSE endpoint
  console.log('4️⃣ Connecting to SSE endpoint...');
  console.log(`   URL: ${API_URL}/runs/${run.id}/progress/stream\n`);
  console.log('📡 Listening for events (Ctrl+C to stop):\n');
  console.log('─'.repeat(60));

  // Use EventSource-like behavior with fetch
  const sseUrl = `${API_URL}/runs/${run.id}/progress/stream`;
  const sseRes = await fetch(sseUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'text/event-stream',
    },
  });

  if (!sseRes.ok) {
    const error = await sseRes.text();
    console.error('SSE connection failed:', error);
    return;
  }

  // Read the stream
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('\n─'.repeat(60));
      console.log('✅ Stream ended');
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    
    // Parse SSE events
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('\n📌 Received [DONE] marker');
          continue;
        }
        try {
          const event = JSON.parse(data);
          const timestamp = new Date(event.timestamp).toLocaleTimeString();
          
          // Format output based on event type
          switch (event.type) {
            case 'run:started':
              console.log(`\n🚀 [${timestamp}] RUN STARTED`);
              console.log(`   Recording: ${event.recordingName}`);
              console.log(`   Browser: ${event.browser}`);
              console.log(`   Total Actions: ${event.totalActions}`);
              break;
            case 'action:started':
              console.log(`\n▶️  [${timestamp}] ACTION ${event.actionIndex + 1}/${event.totalActions} STARTED`);
              console.log(`   Type: ${event.actionType}`);
              console.log(`   ID: ${event.actionId}`);
              break;
            case 'action:success':
              console.log(`   ✅ SUCCESS (${event.durationMs}ms)`);
              if (event.selectorUsed) {
                console.log(`   Selector: ${event.selectorUsed}`);
              }
              break;
            case 'action:failed':
              console.log(`   ❌ FAILED (${event.durationMs}ms)`);
              console.log(`   Error: ${event.errorMessage}`);
              break;
            case 'action:skipped':
              console.log(`   ⏭️  SKIPPED: ${event.reason}`);
              break;
            case 'run:completed':
              console.log(`\n🏁 [${timestamp}] RUN COMPLETED`);
              console.log(`   Status: ${event.status.toUpperCase()}`);
              console.log(`   Duration: ${event.durationMs}ms`);
              console.log(`   Actions: ${event.actionsExecuted} executed, ${event.actionsFailed} failed`);
              break;
            case 'run:error':
              console.log(`\n💥 [${timestamp}] RUN ERROR`);
              console.log(`   Error: ${event.errorMessage}`);
              break;
            default:
              console.log(`\n📦 [${timestamp}] ${event.type}`);
              console.log(`   ${JSON.stringify(event)}`);
          }
        } catch (e) {
          // Not JSON, just log it
          console.log(`   ${data}`);
        }
      } else if (line.startsWith('event: ')) {
        // Named event
        console.log(`   Event: ${line.slice(7)}`);
      }
    }
  }

  console.log('\n✨ Test complete!');
}

main().catch(console.error);
