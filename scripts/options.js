const LMNT_VOICES_URL = 'https://api.lmnt.com/speech/beta/voices';

let availableVoices = {};

// Saves options to chrome.storage
const saveOptions = () => {
  const key = document.getElementById('lmnt_api_key');
  lmnt_api_key = key.value.trim();
  chrome.storage.sync.set(
    { lmnt_api_key },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      if (lmnt_api_key.length > 0) {
        maybePopulateVoices(lmnt_api_key);
      }
      setTimeout(() => {
        status.textContent = '';
      }, 750);
    }
  );
};

// Restores api key value using the preferences stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    { lmnt_api_key: '' },
    (items) => {
      document.getElementById('lmnt_api_key').value = items.lmnt_api_key;
      if (items.lmnt_api_key.trim().length > 0) {
        maybePopulateVoices(items.lmnt_api_key);
      }
    }
  );
};

const maybePopulateVoices = async (apiKey) => {
  const voiceResponse = await fetchVoices(apiKey);
  if (!voiceResponse || !voiceResponse.voices) {
    return;
  }

  availableVoices = voiceResponse.voices;
  maybeAddVoiceOptions();
};

const fetchVoices = async (apiKey) => {
  return fetch(LMNT_VOICES_URL, {
    headers: {
      'X-API-Key': apiKey
    },
    method: 'GET'
  }).then(response => response.json());
};

const maybeAddVoiceOptions = async () => {
  if (Object.keys(availableVoices).length == 0) {
    document.getElementById('voiceOptions').style.display = 'hidden';
    return;
  }

  document.getElementById('voiceOptions').style.display = 'block';
  populateVoiceSelectMenu(voiceSelect, availableVoices);
  voiceSelect.addEventListener('change', saveDefaultVoice);
};

const saveDefaultVoice = () => {
  const default_voice_id = voiceSelect.value;
  chrome.storage.sync.set(
    { default_voice_id },
    () => console.log(`Saved default voice: ${default_voice_id}`)
  );
};

const populateVoiceSelectMenu = (containerEl, availableVoices) => {
  addOption(containerEl, 'lmnt-chooses', '(Let LMNT choose)');
  for (const voiceId of Object.keys(availableVoices)) {
    const voiceName = availableVoices[voiceId].name;
    addOption(containerEl, voiceId, voiceName);
  }
};

const addOption = (selectEl, voiceId, voiceName) => {
  let option = document.createElement('option');
  option.value = voiceId;
  option.textContent = voiceName;
  selectEl.appendChild(option);
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
maybeAddVoiceOptions();
