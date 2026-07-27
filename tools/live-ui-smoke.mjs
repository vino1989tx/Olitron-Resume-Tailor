const debugPort = process.argv[2] || '9223';
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No debuggable Chrome page was found.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 0;
let interceptedRequests = 0;
const pending = new Map();
socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }

  if (message.method === 'Fetch.requestPaused') {
    interceptedRequests += 1;
    const isPreflight = message.params.request.method === 'OPTIONS';
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              client: 'Professional Summary',
              updatedBullets: Array.from(
                { length: 13 },
                (_, index) => `Reframed transferable software engineering achievement ${index + 1}.`,
              ),
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        prompt_tokens_details: { cached_tokens: 0 },
      },
    };

    void send('Fetch.fulfillRequest', {
      requestId: message.params.requestId,
      responseCode: isPreflight ? 204 : 200,
      responseHeaders: [
        { name: 'content-type', value: 'application/json' },
        { name: 'access-control-allow-origin', value: '*' },
        { name: 'access-control-allow-methods', value: 'POST, OPTIONS' },
        {
          name: 'access-control-allow-headers',
          value:
            'authorization, content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
        },
      ],
      body: isPreflight ? '' : Buffer.from(JSON.stringify(mockResponse)).toString('base64'),
    });
  }
};

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.result.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.text);
  }
  return response.result.result.value;
}

await send('Runtime.enable');
await new Promise((resolve) => setTimeout(resolve, 500));

await evaluate(`window.fetch = async () => new Response(JSON.stringify({
  content: [{
    type: 'text',
    text: JSON.stringify({
      client: 'Professional Summary',
      updatedBullets: Array.from(
        { length: 13 },
        (_, index) => 'Reframed transferable software engineering achievement ' + (index + 1) + '.'
      )
    })
  }],
  choices: [{
    message: {
      content: JSON.stringify({
        client: 'Professional Summary',
        updatedBullets: Array.from(
          { length: 13 },
          (_, index) => 'Reframed transferable software engineering achievement ' + (index + 1) + '.'
        )
      })
    }
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    prompt_tokens_details: { cached_tokens: 0 }
  }
}), {
  status: 200,
  headers: { 'content-type': 'application/json' }
})`);

const initial = await evaluate(`({
  appTitle: document.querySelector('.app-topbar h1')?.textContent?.trim(),
  originalSummary: document.querySelector('.resume-bullets li')?.textContent?.trim(),
  apiConfigured: ![...document.querySelectorAll('.status-error')]
    .some((element) => element.textContent.includes('No AI API key configured'))
})`);

const setup = await evaluate(`(() => {
  const summaryCheckbox = document.querySelectorAll('.scope-item input')[1];
  summaryCheckbox.click();
  const textarea = document.querySelector('#jd-textarea');
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  valueSetter.call(textarea, 'Angular, TypeScript, RxJS, NgRx, REST APIs, Azure, CI/CD, accessibility, testing, and technical leadership.');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  return {
    selected: summaryCheckbox.checked,
    tailorEnabled: !document.querySelector('.primary-btn').disabled,
  };
})()`);

await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('.primary-btn').click()`);

let result;
for (let attempt = 0; attempt < 50; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  result = await evaluate(`({
    success: document.querySelector('.status-success')?.textContent?.trim() || '',
    buttonText: document.querySelector('.primary-btn')?.textContent?.trim() || '',
    error: [...document.querySelectorAll('.status-error')].map((element) => element.textContent.trim()).join(' | '),
    highlightedLines: document.querySelectorAll('li.tailored-line').length,
    tailoredBadges: document.querySelectorAll('.tailored-badge').length,
    firstUpdatedLine: document.querySelector('li.tailored-line')?.textContent?.trim() || '',
  })`);
  if (result.success || result.error) break;
}

console.log(JSON.stringify({ initial, setup, interceptedRequests, result }, null, 2));
socket.close();

if (
  initial.appTitle !== 'Olitron Resume Tailor' ||
  !initial.apiConfigured ||
  !setup.selected ||
  !setup.tailorEnabled ||
  !result.success ||
  result.error ||
  result.highlightedLines !== 13 ||
  result.tailoredBadges !== 1
) {
  process.exitCode = 1;
}
