const LMNT_SYNTHESIZE_URL = 'https://api.lmnt.com/speech/beta/synthesize';
const LMNT_ORACLE_URL = 'https://api.lmnt.com/anya/beta/oracle';

const CUSTOM_VOICES = {
};

const LMNT_AUDIO_CSS_CLASS = 'lmnt-audio';
const TICK_DELAY = 1000;
const LONG_TICK_DELAY = 5000;

let lmntApiKey = '';
chrome.storage.sync.get(["lmnt_api_key"]).then((result) => {
  setLmntApiKey(result.lmnt_api_key);
  if (!lmntApiKey) {
    // console.log('No LMNT api key, opening options page.');
    chrome.runtime.sendMessage("showOptions");
  }
  setTimeout(tick, TICK_DELAY);
});

function setLmntApiKey(key) {
  lmntApiKey = key || '';
};

// Watch for changes to the user's options and apply them.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.lmnt_api_key) {
    const newKey = changes.lmnt_api_key.newValue;
    setLmntApiKey(newKey);
  }
});

let selectedVoice;
let lastCharacterName;
let latestMessageRow;

async function tick() {
  if (!lmntApiKey) {
    setTimeout(tick, LONG_TICK_DELAY);
    return;
  }

  [selectedVoice, lastCharacterName] = await computeVoice(lmntApiKey, lastCharacterName, selectedVoice);
  if (selectedVoice) {
    latestMessageRow = processLatestMessage(lmntApiKey, selectedVoice, lastCharacterName, latestMessageRow);
  }

  maybeFixJankedAudioElement();
  setTimeout(tick, TICK_DELAY);
};

function maybeFixJankedAudioElement() {
  // When the user submits a new chat message, character.ai updates the previously most
  // recent message (which contained a rating widget and next/prev-take buttons). That
  // row's contents are effectively rebuilt in a way that places them below the audio
  // element we had previously carefully positioned beneath the text. We can't find a
  // place in the DOM to put it that will persist in a visually satisfying manner, so
  // our only recourse is to check for the janked positioning and move the element back
  // to a suitable position. This should only end up having to be done once per message,
  // and only once it's been moved to the previously-most-recent message spot.

  const audioElements = document.querySelectorAll('audio.' + LMNT_AUDIO_CSS_CLASS);
  if (!audioElements || audioElements.length == 0) {
    return;
  }

  // There can only be one, and it would be the last one, if present.
  const e = audioElements[audioElements.length - 1];
  const parent = e.parentElement;
  // If we're the first child of our parent, this was a rebuilt message, and we
  // need to move the audio element to follow the 'div.row' element.
  if (parent.childNodes[0] == e) {
    parent.removeChild(e);
    parent.append(e);
  }
};

async function computeVoice(lmntApiKey, lastCharacterName, lastSelectedVoice) {
  let characterName;
  let selectedVoice;

  // console.log('Looking for character name.');
  const appPageElement = document.querySelector('.apppage');
  if (appPageElement) {
    const chatTitleElement = appPageElement.querySelector('.chattitle');
    if (chatTitleElement) {
      const characterNameElement = chatTitleElement.childNodes[0];
      characterName = characterNameElement.wholeText.trim();
      // console.log(`Found character info [name=${characterName}].`);

      if (characterName && characterName != lastCharacterName) {
        selectedVoice = CUSTOM_VOICES[characterName.toLowerCase()];
        if (selectedVoice) {
          console.log(`Selected custom voice [name=${characterName}, voice=${selectedVoice}].`)
        } else {
          const response = await ohOracleOfTheLakeWhatIsYourWisdom(lmntApiKey, characterName)
          selectedVoice = response["voice_id"]

          console.log(`Oracle selected voice [name=${characterName}, voice=${selectedVoice}].`)
        }
      } else {
        selectedVoice = lastSelectedVoice;
      }
    }
  }

  return [selectedVoice, characterName];
};

function processLatestMessage(apiKey, selectedVoice, characterName, previousRow) {
  const currentMessageRow = getLatestChatTextElement();
  // cmrtext = currentMessageRow ? currentMessageRow.innerText : '';
  // pmrtext = previousRow ? previousRow.innerText : '';
  // console.log(`processLatestMessage [name=${characterName}, cmrtext=${cmrtext}, pmrtext=${pmrtext}].`);
  if (!currentMessageRow || currentMessageRow == previousRow) {
    return currentMessageRow;
  }

  const swiperElement = currentMessageRow.querySelector('.swiper-button-next');
  if (!swiperElement || swiperElement.classList.contains('swiper-button-disabled')) {
    // Text must still be rendering, so wait for it to finish and appear.
    // console.log('no enabled swiper element yet, returning previous row');
    return previousRow;
  }

  const latestText = getLatestChatText(currentMessageRow, characterName);
  // console.log(`Processing new message row [latestText=${latestText}, name=${characterName}, voice.id=${selectedVoice.id}].`);
  if (!latestText) {
    return previousRow;
  }
  console.log(`Speak: '${latestText}'.`);
  synthesizeText(apiKey, selectedVoice, latestText)
    .then(response => response.blob())
    .then(blob => {
      const audioBlobUrl = URL.createObjectURL(blob)
      const audioElement = new Audio(audioBlobUrl);
      audioElement.classList.add(LMNT_AUDIO_CSS_CLASS);
      audioElement.controls = true;
      audioElement.style = 'margin-left: 40px;';
      audioElement.autoplay = true;
      getLatestChatTextElement().appendChild(audioElement);
    });
  return currentMessageRow;
};

function getLatestChatTextElement() {
  const messageRowElements = document.querySelectorAll('.msg-row');
  return (messageRowElements.length == 0) ? null : messageRowElements[messageRowElements.length - 1];
};

function getLatestChatText(messageRowElement, targetSpeakerName) {
  const rawText = messageRowElement.innerText;
  const speakerName = rawText.substring(0, rawText.indexOf("\n"));
  if (speakerName == targetSpeakerName) {
    // Usually there's only one 'p', but for folks like Severus Snape, sometimes they drop multiple paragraphs
    // for separating markdown-like sections, so we have to iterate over however many 'p's there are.
    const pElements = messageRowElement.querySelectorAll('p');
    let messageText = '';
    if (pElements) {
      for (let i = 0; i < pElements.length; i++) {
        messageText += pElements[i] ? (pElements[i].innerText + ' ') : '';
      }
    }
    return messageText;
  }
  return '';
};

async function ohOracleOfTheLakeWhatIsYourWisdom(apiKey, character) {
  const formData = new FormData();
  formData.append('name', character);
  return fetch(LMNT_ORACLE_URL, {
    headers: {
      'X-API-Key': apiKey
    },
    method: 'POST',
    body: formData
  }).then(response => response.json());
};

async function synthesizeText(apiKey, voice, text) {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('voice', voice);

  return fetch(LMNT_SYNTHESIZE_URL, {
    headers: {
      'X-API-Key': apiKey
    },
    method: 'POST',
    body: formData
  });
};
